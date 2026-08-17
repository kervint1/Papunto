import hashlib
import hmac
import json
import logging
from typing import Any
from urllib.parse import parse_qsl

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse
from sqlmodel import Session

import config
from database import get_session
from errors import ApiError
from models.postback import STATUS_APPROVED, STATUS_PENDING, STATUS_REJECTED
from services import postback_service
from services.cpalead_service import CPALeadService

router = APIRouter(tags=["postback"])
logger = logging.getLogger("postback")


def _client_ip(request: Request) -> str:
    """実際の送信元IPを取り出す。

    Herokuでは常にルーター経由でリクエストが届くため、request.client.host はルーターのIPになる。
    X-Forwarded-For の先頭（＝もっとも外側のクライアント）を見る必要がある
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


async def _payload(request: Request) -> dict[str, Any]:
    """クエリとボディを混ぜた生ペイロードを返す。

    ポストバックはGETでもPOSTでも届きうる。どちらで来ても同じ形で扱えるようにする。
    ボディは request.form() を使わず自前で解析する（form()はpython-multipartを要求するため、
    そのためだけに依存を増やしたくない）
    """
    params: dict[str, Any] = dict(request.query_params)
    if request.method != "POST":
        return params

    body = (await request.body()).decode("utf-8", errors="replace")
    if not body:
        return params

    if request.headers.get("content-type", "").startswith("application/json"):
        try:
            data = json.loads(body)
        except ValueError:
            return params
        if isinstance(data, dict):
            params.update(data)
    else:
        params.update(dict(parse_qsl(body, keep_blank_values=True)))
    return params


# ---------------------------------------------------------------- Monlix

def verify_postback_hash(userid: str, transaction_id: str, amount: str, received_hash: str | None) -> bool:
    # TODO: Monlix契約後、実際のPostback署名仕様（アルゴリズム・パラメータ順）に差し替える。
    #       あわせて「シークレット未設定なら検証をスキップ」もやめる（CPALead側と同じく、
    #       未設定なら付与しない方針に揃える）。現状はMonlix未契約で仕様が固まらないため残している
    if not config.MONLIX_POSTBACK_SECRET:
        return True  # 開発中（シークレット未設定）は検証をスキップ
    expected = hashlib.sha256(
        f"{transaction_id}:{userid}:{amount}:{config.MONLIX_POSTBACK_SECRET}".encode()
    ).hexdigest()
    return hmac.compare_digest(expected, received_hash or "")


@router.get("/postback/monlix", response_class=PlainTextResponse)
def monlix_postback(
    userid: str,
    transaction_id: str,
    amount: str,
    status: str = "1",
    hash: str | None = None,
    session: Session = Depends(get_session),
):
    if not verify_postback_hash(userid, transaction_id, amount, hash):
        logger.warning("Postback signature mismatch: transaction_id=%s", transaction_id)
        raise ApiError(403, "INVALID_SIGNATURE", "Invalid signature")

    if status != "1":
        # 承認済み以外の通知は付与せず正常応答（Monlixの再送を止める）
        return "OK"

    try:
        # Monlixの仮想通貨（Coins/Points）は整数で届く
        reward_points = int(amount)
    except ValueError:
        raise ApiError(422, "INVALID_AMOUNT", "Invalid amount")
    if reward_points <= 0:
        raise ApiError(422, "INVALID_AMOUNT", "Invalid amount")

    postback_service.process_conversion(
        session,
        provider="monlix",
        userid=userid,
        transaction_id=transaction_id,
        reward_points=reward_points,
        status=STATUS_APPROVED,
    )
    return "OK"


# ---------------------------------------------------------------- CPALead

# CPALeadから届くパラメータ名（マクロ名）。契約後にダッシュボードで確定するため、
# 差し替えが必要になるのはこの定数群だけになるようにしておく
# TODO: 契約後、実際のマクロ名に合わせて直す
P_SUBID = "subid"                        # = users.id
P_TRANSACTION_ID = "transaction_id"      # 冪等キー（CPALeadのlead_id相当）
P_PAYOUT = "payout"                      # USD建ての報酬額
P_VIRTUAL_CURRENCY = "virtual_currency"  # ポイント建ての報酬額（あればこちらを優先）
P_CAMPAIGN_ID = "campid"
P_CAMPAIGN_NAME = "campaign_name"
P_STATUS = "status"
P_HASH = "hash"

# TODO: 契約後、実際に送られてくる値に合わせて直す
CPALEAD_STATUS_MAP = {
    "0": STATUS_PENDING,
    "1": STATUS_APPROVED,
    "2": STATUS_REJECTED,
    "pending": STATUS_PENDING,
    "approved": STATUS_APPROVED,
    "rejected": STATUS_REJECTED,
}


# GETとPOSTの両方で受ける（CPALeadがどちらで送るか契約後に確定するため）。
#
# ⚠️ api_route(methods=["GET","POST"]) だと2つの操作が同じ operationId になり、
#    OpenAPIからクライアントを生成したときに識別子が衝突する（papunto-nativeのOrval）。
#    関数名を分けて別々に登録する。
@router.get("/postback/cpalead", response_class=PlainTextResponse)
async def cpalead_postback_get(request: Request, session: Session = Depends(get_session)):
    return await _cpalead_postback(request, session)


@router.post("/postback/cpalead", response_class=PlainTextResponse)
async def cpalead_postback_post(request: Request, session: Session = Depends(get_session)):
    return await _cpalead_postback(request, session)


async def _cpalead_postback(request: Request, session: Session):
    params = await _payload(request)
    remote_ip = _client_ip(request)

    subid = str(params.get(P_SUBID, ""))
    transaction_id = str(params.get(P_TRANSACTION_ID, ""))
    campaign_id = str(params.get(P_CAMPAIGN_ID, ""))
    received_hash = params.get(P_HASH)

    # 1. 送信元IP。ここで弾いた分はログに残さない。許可外からの大量リクエストで
    #    postback_logs が埋まると、本当に調べたい記録が行数上限に押し出されてしまう
    if not CPALeadService.verify_ip(remote_ip):
        logger.warning("CPALead postback from disallowed IP: remote_ip=%s", remote_ip)
        raise ApiError(403, "FORBIDDEN_IP", "Forbidden")

    # 2. 署名。失敗しても「届いたが弾いた」記録は残す（設定不整合の事後追跡のため）
    payload = CPALeadService.signature_payload(subid, transaction_id, campaign_id)
    if not CPALeadService.verify_signature(payload, received_hash):
        postback_service.log_callback(
            session,
            provider="cpalead",
            params=params,
            http_method=request.method,
            remote_ip=remote_ip,
            verified=False,
            signature=received_hash,
            transaction_id=transaction_id or None,
        )
        logger.error("CPALead postback signature mismatch: transaction_id=%s", transaction_id)
        raise ApiError(403, "INVALID_SIGNATURE", "Invalid signature")

    postback_service.log_callback(
        session,
        provider="cpalead",
        params=params,
        http_method=request.method,
        remote_ip=remote_ip,
        verified=True,
        signature=received_hash,
        transaction_id=transaction_id or None,
    )

    if not transaction_id:
        raise ApiError(422, "INVALID_TRANSACTION_ID", "Invalid transaction_id")

    # 3. 報酬額。ポイント建てで届くならそれを使い、無ければUSDから換算する
    payout_usd = CPALeadService.parse_usd(params.get(P_PAYOUT))
    virtual_currency = params.get(P_VIRTUAL_CURRENCY)
    if virtual_currency not in (None, ""):
        try:
            reward_points = int(float(virtual_currency))
        except (TypeError, ValueError):
            raise ApiError(422, "INVALID_AMOUNT", "Invalid amount")
    else:
        reward_points = CPALeadService.usd_to_points(payout_usd)

    # 4. ステータス
    raw_status = str(params.get(P_STATUS, "1")).lower()
    status = CPALEAD_STATUS_MAP.get(raw_status)
    if status is None:
        logger.error(
            "CPALead postback with unknown status: transaction_id=%s status=%s",
            transaction_id, raw_status,
        )
        return "OK"

    postback_service.process_conversion(
        session,
        provider="cpalead",
        userid=subid,
        transaction_id=transaction_id,
        reward_points=reward_points,
        status=status,
        payout_usd=payout_usd or None,
        campaign_id=campaign_id or None,
        campaign_name=str(params.get(P_CAMPAIGN_NAME, "")) or None,
    )
    # TODO: 契約後、CPALeadが期待するレスポンス形式を確認する。GF Rewards のように
    #       常時200を返しボディの値で結果を区別する仕様の提供元もある
    return "OK"
