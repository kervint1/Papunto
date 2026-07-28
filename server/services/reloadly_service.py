import time
from decimal import Decimal
from typing import Optional

import requests

import config


class ReloadlyError(Exception):
    """Reloadly呼び出し失敗時の内部例外。routerがApiErrorに変換する"""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class ReloadlyService:
    """Reloadly Topups APIのラッパー（トークン発行・キャリア判定・チャージ実行）"""

    _token: Optional[str] = None
    _expires_at: float = 0.0  # unix timestamp

    @classmethod
    def _get_access_token(cls) -> str:
        # 期限切れ60秒前から再取得（クロックスキュー対策）
        if cls._token and time.time() < cls._expires_at - 60:
            return cls._token
        try:
            resp = requests.post(
                config.RELOADLY_AUTH_URL,
                json={
                    "client_id": config.RELOADLY_CLIENT_ID,
                    "client_secret": config.RELOADLY_CLIENT_SECRET,
                    "grant_type": "client_credentials",
                    "audience": config.RELOADLY_API_BASE,
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as exc:
            raise ReloadlyError("RELOADLY_UNAVAILABLE", f"No se pudo autenticar con Reloadly: {exc}")
        cls._token = data["access_token"]
        cls._expires_at = time.time() + data["expires_in"]
        return cls._token

    @classmethod
    def detect_operator(cls, phone_number: str) -> dict:
        token = cls._get_access_token()
        try:
            resp = requests.get(
                f"{config.RELOADLY_API_BASE}/operators/auto-detect/phone/{phone_number}/countries/PE",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/com.reloadly.topups-v1+json",
                },
                timeout=10,
            )
        except requests.RequestException as exc:
            raise ReloadlyError("RELOADLY_UNAVAILABLE", f"Error de red con Reloadly: {exc}")
        if resp.status_code == 404:
            raise ReloadlyError("OPERATOR_NOT_FOUND", "No se pudo identificar el operador para este número")
        try:
            resp.raise_for_status()
            data = resp.json()
        except (requests.RequestException, ValueError) as exc:
            raise ReloadlyError("RELOADLY_UNAVAILABLE", f"Respuesta inválida de Reloadly: {exc}")
        if "id" not in data:
            raise ReloadlyError("OPERATOR_NOT_FOUND", "No se pudo identificar el operador para este número")
        return {"operator_id": data["id"], "operator_name": data.get("name", "")}

    @classmethod
    def execute_topup(
        cls, phone_number: str, operator_id: int, amount_soles: Decimal, custom_identifier: str
    ) -> dict:
        token = cls._get_access_token()
        try:
            resp = requests.post(
                f"{config.RELOADLY_API_BASE}/topups",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/com.reloadly.topups-v1+json",
                    "Content-Type": "application/json",
                },
                json={
                    "recipientPhone": {"countryCode": "PE", "number": phone_number},
                    "operatorId": operator_id,
                    "amount": float(amount_soles),
                    "useLocalAmount": True,
                    "customIdentifier": custom_identifier,
                },
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()
        except (requests.RequestException, ValueError) as exc:
            raise ReloadlyError("TOPUP_FAILED", f"La recarga fue rechazada por Reloadly: {exc}")
        return {"transaction_id": str(data.get("transactionId", ""))}
