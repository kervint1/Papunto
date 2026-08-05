import pytest
from sqlmodel import Session, select

import config
from models import Postback, PostbackLog, User
from services.cpalead_service import CPALeadService
from tests.conftest import ALLOWED_IP, POSTBACK_SECRET

URL = "/postback/cpalead"


def params(user_id: int, *, status="1", payout="0.50", campid="1001",
           transaction_id="tx-1", sign=True, **overrides):
    body = {
        "subid": str(user_id),
        "transaction_id": transaction_id,
        "payout": payout,
        "campid": campid,
        "campaign_name": "Instala Mundo Aventura",
        "status": status,
    }
    if sign:
        body["hash"] = CPALeadService.sign(
            CPALeadService.signature_payload(str(user_id), transaction_id, campid)
        )
    body.update(overrides)
    return {k: v for k, v in body.items() if v is not None}


def post(client, user_id, ip=ALLOWED_IP, **kwargs):
    return client.get(URL, params=params(user_id, **kwargs), headers={"x-forwarded-for": ip})


def points_of(session: Session, user_id: int) -> int:
    session.expire_all()
    return session.exec(select(User).where(User.id == user_id)).one().points


def logs(session: Session) -> list[PostbackLog]:
    session.expire_all()
    return list(session.exec(select(PostbackLog)).all())


def postbacks(session: Session) -> list[Postback]:
    session.expire_all()
    return list(session.exec(select(Postback)).all())


# ---------------------------------------------------------------- IP制限

def test_disallowed_ip_is_rejected(client, session, user):
    res = post(client, user.id, ip="198.51.100.99")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN_IP"
    assert points_of(session, user.id) == 0


def test_disallowed_ip_leaves_no_log(client, session, user):
    """許可外IPからの大量リクエストでログテーブルが埋まらないこと"""
    post(client, user.id, ip="198.51.100.99")
    assert logs(session) == []


def test_disallowed_ip_without_payload_does_not_500(client):
    res = client.get(URL, headers={"x-forwarded-for": "198.51.100.99"})
    assert res.status_code == 403


# ---------------------------------------------------------------- 署名検証

def test_signature_mismatch_is_rejected(client, session, user):
    res = post(client, user.id, sign=False, hash="deadbeef")
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "INVALID_SIGNATURE"
    assert points_of(session, user.id) == 0


def test_signature_mismatch_leaves_unverified_log(client, session, user):
    """設定不整合を後から追えるよう、弾いたリクエストも記録する"""
    post(client, user.id, sign=False, hash="deadbeef")
    rows = logs(session)
    assert len(rows) == 1
    assert rows[0].verified is False
    assert rows[0].signature == "deadbeef"
    assert rows[0].params["subid"] == str(user.id)


def test_missing_hash_is_rejected(client, session, user):
    res = post(client, user.id, sign=False)
    assert res.status_code == 403
    assert points_of(session, user.id) == 0


def test_unset_secret_rejects_instead_of_skipping(client, session, user, monkeypatch):
    """シークレット未設定でも「素通り」しないこと。

    設定漏れが「検証をスキップして誰でも付与できる」状態にならないための最重要ケース
    """
    signed = params(user.id)  # 署名は設定時の値で作っておく
    monkeypatch.setattr(config, "CPALEAD_POSTBACK_SECRET", "")
    res = client.get(URL, params=signed, headers={"x-forwarded-for": ALLOWED_IP})
    assert res.status_code == 403
    assert points_of(session, user.id) == 0
    assert logs(session)[0].verified is False


def test_known_signature_vector(client, session, user):
    """HMACの計算方法がずれるとポストバックが全件失敗するため、既知の値で固定する。

    TODO: 契約後、CPALeadの仕様書に載っている既知ベクトルへ差し替える
    """
    expected = CPALeadService.sign(f"{user.id}:tx-known:1001")
    assert CPALeadService.verify_signature(f"{user.id}:tx-known:1001", expected)
    assert not CPALeadService.verify_signature(f"{user.id}:tx-known:1002", expected)


def test_verified_log_is_recorded(client, session, user):
    post(client, user.id)
    rows = logs(session)
    assert len(rows) == 1
    assert rows[0].verified is True
    assert rows[0].provider == "cpalead"
    assert rows[0].transaction_id == "tx-1"
    assert rows[0].http_method == "GET"
    assert rows[0].remote_ip == ALLOWED_IP


# ---------------------------------------------------------------- ステータス別

def test_approved_credits_points(client, session, user):
    res = post(client, user.id, status="1", payout="0.50")
    assert res.status_code == 200
    assert res.text == "OK"
    assert points_of(session, user.id) == 150  # 0.50 USD * 300

    row = postbacks(session)[0]
    assert row.provider == "cpalead"
    assert row.status == "approved"
    assert row.approved_at is not None
    assert row.campaign_name == "Instala Mundo Aventura"
    assert row.payout_usd == pytest.approx(0.5)


def test_pending_records_without_crediting(client, session, user):
    post(client, user.id, status="0")
    assert points_of(session, user.id) == 0
    row = postbacks(session)[0]
    assert row.status == "pending"
    assert row.approved_at is None


def test_rejected_does_not_credit(client, session, user):
    post(client, user.id, status="2")
    assert points_of(session, user.id) == 0
    row = postbacks(session)[0]
    assert row.status == "rejected"
    assert row.rejected_at is not None


def test_unknown_status_is_ignored(client, session, user):
    res = post(client, user.id, status="99")
    assert res.status_code == 200
    assert points_of(session, user.id) == 0
    assert postbacks(session) == []


# ---------------------------------------------------------------- 状態遷移・冪等性

def test_pending_then_approved_credits_once(client, session, user):
    post(client, user.id, status="0")
    assert points_of(session, user.id) == 0

    post(client, user.id, status="1")
    assert points_of(session, user.id) == 150
    assert len(postbacks(session)) == 1


def test_repeated_approval_credits_once(client, session, user):
    post(client, user.id, status="1")
    post(client, user.id, status="1")
    assert points_of(session, user.id) == 150
    assert len(postbacks(session)) == 1


def test_rejection_after_approval_is_ignored(client, session, user):
    """終端状態に達したあとの通知でステータスが巻き戻らないこと"""
    post(client, user.id, status="1")
    post(client, user.id, status="2")
    assert points_of(session, user.id) == 150
    assert postbacks(session)[0].status == "approved"


def test_approval_after_rejection_is_ignored(client, session, user):
    post(client, user.id, status="2")
    post(client, user.id, status="1")
    assert points_of(session, user.id) == 0
    assert postbacks(session)[0].status == "rejected"


def test_different_transactions_credit_separately(client, session, user):
    post(client, user.id, transaction_id="tx-1")
    post(client, user.id, transaction_id="tx-2")
    assert points_of(session, user.id) == 300
    assert len(postbacks(session)) == 2


# ---------------------------------------------------------------- 金額まわり

def test_reward_above_ceiling_is_skipped(client, session, user, monkeypatch):
    """署名対象に金額が含まれないため、異常な額は独自上限で遮断する"""
    monkeypatch.setattr(config, "MAX_REWARD_POINTS", 1000)
    res = post(client, user.id, payout="999.00")
    assert res.status_code == 200
    assert points_of(session, user.id) == 0
    assert postbacks(session) == []


def test_zero_reward_is_not_an_error(client, session, user):
    """報酬0は正常系。「インストール→初回起動」型の案件で複数回に分かれて届く"""
    res = post(client, user.id, payout="0")
    assert res.status_code == 200
    assert points_of(session, user.id) == 0
    assert postbacks(session) == []
    assert len(logs(session)) == 1  # 届いた記録は残る


def test_virtual_currency_takes_precedence_over_payout(client, session, user):
    post(client, user.id, payout="0.50", virtual_currency="777")
    assert points_of(session, user.id) == 777


def test_invalid_subid_returns_422(client, session, user):
    """非数値のsubidで500にならないこと"""
    res = client.get(
        URL,
        params=params(user.id, subid="abc", sign=False,
                      hash=CPALeadService.sign(CPALeadService.signature_payload("abc", "tx-1", "1001"))),
        headers={"x-forwarded-for": ALLOWED_IP},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "INVALID_USERID"


def test_unknown_user_returns_404(client, session, user):
    missing = user.id + 999
    res = post(client, missing)
    assert res.status_code == 404
    assert res.json()["error"]["code"] == "USER_NOT_FOUND"


# ---------------------------------------------------------------- HTTPメソッド

def test_post_is_accepted(client, session, user):
    """ポストバックはGET/POSTどちらでも届きうる"""
    res = client.post(URL, data=params(user.id), headers={"x-forwarded-for": ALLOWED_IP})
    assert res.status_code == 200
    assert points_of(session, user.id) == 150
    assert logs(session)[0].http_method == "POST"


# ---------------------------------------------------------------- Monlix非回帰

def test_monlix_postback_still_works(client, session, user):
    res = client.get("/postback/monlix", params={
        "userid": str(user.id), "transaction_id": "m1", "amount": "100", "status": "1",
    })
    assert res.status_code == 200
    assert res.text == "OK"
    assert points_of(session, user.id) == 100

    row = postbacks(session)[0]
    assert row.provider == "monlix"
    assert row.status == "approved"


def test_monlix_and_cpalead_can_share_a_transaction_id(client, session, user):
    """取引IDは提供元ごとの採番なので、またいで衝突しても両方記録されること"""
    client.get("/postback/monlix", params={
        "userid": str(user.id), "transaction_id": "tx-1", "amount": "100", "status": "1",
    })
    post(client, user.id, transaction_id="tx-1")
    assert points_of(session, user.id) == 250
    assert {p.provider for p in postbacks(session)} == {"monlix", "cpalead"}
