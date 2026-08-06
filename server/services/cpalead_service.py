import hashlib
import hmac
from decimal import Decimal, InvalidOperation
from typing import Optional
from urllib.parse import urlencode

import requests

import config


class CPALeadError(Exception):
    """CPALead呼び出し失敗時の内部例外。routerがApiErrorに変換する"""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class CPALeadService:
    """CPALeadオファーウォールのラッパー（オファー取得・リンク署名・ポストバック検証）

    CPALEAD_MOCK=true のときは config.CPALEAD_API_BASE が自サーバーのモックを指すため、
    このクラス自体には分岐を持たせない。本番と同じHTTP経路を通すことで、契約後は
    ベースURLを差し替えるだけで実接続に切り替わる。
    """

    # ---- オファー取得 ----

    @classmethod
    def fetch_offers(cls, subid: str) -> list[dict]:
        try:
            resp = requests.get(
                f"{config.CPALEAD_API_BASE}/offers",
                params={"id": config.CPALEAD_API_KEY, "subid": subid, "format": "json"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
        except (requests.RequestException, ValueError) as exc:
            raise CPALeadError("CPALEAD_UNAVAILABLE", f"No se pudieron cargar las tareas: {exc}")

        raw_offers = data.get("offers")
        if not isinstance(raw_offers, list):
            raise CPALeadError("CPALEAD_UNAVAILABLE", "Respuesta inválida de CPALead")

        offers = []
        for raw in raw_offers:
            normalized = cls._normalize(raw, subid)
            if normalized is not None:
                offers.append(normalized)
        return offers

    @classmethod
    def _normalize(cls, raw: dict, subid: str) -> Optional[dict]:
        """CPALeadの生JSONを自前のオファー形式に変換する。

        TODO: 契約後、実際のレスポンスのキー名・型をダッシュボードで確認して直す。
              CPALead側の仕様変更を受け止めるのはこの関数だけにする。
        """
        campaign_id = str(raw.get("campid") or "").strip()
        title = str(raw.get("title") or "").strip()
        if not campaign_id or not title:
            return None  # 識別も表示もできないオファーは捨てる

        return {
            "campaign_id": campaign_id,
            "title": title,
            "description": str(raw.get("description") or "").strip() or None,
            "points": cls.usd_to_points(raw.get("amount")),
            "link": cls.build_offer_link(campaign_id, subid),
            "image_url": str(raw.get("previewurl") or "").strip() or None,
            "conversion": str(raw.get("conversion") or "").strip() or None,
            "device": str(raw.get("device") or "").strip() or None,
        }

    @classmethod
    def usd_to_points(cls, amount: object) -> int:
        """USD建ての報酬額をポイントに換算する（端数は切り捨て）"""
        return int(cls.parse_usd(amount) * config.CPALEAD_USD_TO_POINTS)

    @staticmethod
    def parse_usd(amount: object) -> Decimal:
        """USD額をDecimalで返す。パースできない場合は0。

        CPALeadは "0.50" のような文字列で送ってくる。floatを経由すると誤差が出るため
        文字列からDecimalへ直接変換する
        """
        if amount is None:
            return Decimal(0)
        try:
            value = Decimal(str(amount))
        except (InvalidOperation, ValueError):
            return Decimal(0)
        return value if value > 0 else Decimal(0)

    # ---- オファーリンクの署名 ----

    @classmethod
    def build_offer_link(cls, campaign_id: str, subid: str) -> str:
        """オファー遷移URLを組み立てる。

        subidを生のまま渡すと、他人のIDに書き換えて成果を横取りできてしまう。
        subidと結び付いたdigestを添えて、遷移先で検証できるようにする。

        TODO: 契約後、CPALeadがカスタムパラメータの引き回しに対応しているか確認する。
              対応していない場合は成果の紐付けをsubid単体に頼ることになるため、
              ポストバック側のIP制限と署名検証がいっそう重要になる。
        """
        query = urlencode({
            "campid": campaign_id,
            "subid": subid,
            "digest": cls.build_digest(campaign_id, subid),
        })
        return f"{config.CPALEAD_API_BASE}/click?{query}"

    @staticmethod
    def build_digest(campaign_id: str, subid: str) -> str:
        # オファーリンク用のプレーンSHA256。ポストバックのHMAC-SHA256とは別物
        return hashlib.sha256(
            f"{subid};{campaign_id};{config.CPALEAD_API_KEY}".encode()
        ).hexdigest()

    @classmethod
    def verify_digest(cls, campaign_id: str, subid: str, received: Optional[str]) -> bool:
        if not received:
            return False
        return hmac.compare_digest(cls.build_digest(campaign_id, subid), received)

    # ---- ポストバックの検証 ----

    @staticmethod
    def signature_payload(subid: str, transaction_id: str, campaign_id: str) -> str:
        # TODO: 契約後、CPALeadの署名仕様（対象パラメータと連結順）に合わせて直す
        return f"{subid}:{transaction_id}:{campaign_id}"

    @classmethod
    def verify_signature(cls, payload: str, received: Optional[str]) -> bool:
        """HMAC-SHA256でポストバックの署名を検証する。

        シークレット未設定なら検証を通さない。「未設定なら検証をスキップ」にすると、
        本番で設定を忘れたときに誰でもポイントを付与できる状態になるため
        （開発時は CPALEAD_MOCK=true が既定値を入れるので手が止まらない）
        """
        if not config.CPALEAD_POSTBACK_SECRET:
            return False
        if not received:
            return False
        expected = hmac.new(
            config.CPALEAD_POSTBACK_SECRET.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, received)

    @staticmethod
    def sign(payload: str) -> str:
        """署名を生成する（モックのクリックページとテストから使う）"""
        return hmac.new(
            config.CPALEAD_POSTBACK_SECRET.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()

    @staticmethod
    def verify_ip(remote_ip: str) -> bool:
        """送信元IPが許可リストに含まれるか。

        許可リストが空のときはモック時のみ通す。本番で未設定なら弾く
        （設定漏れが「全許可」になるのを避ける）
        """
        if not config.CPALEAD_ALLOWED_IPS:
            return config.CPALEAD_MOCK
        return remote_ip in config.CPALEAD_ALLOWED_IPS
