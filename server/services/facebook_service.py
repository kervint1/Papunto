"""Facebookログインのトークン検証。

集客がFacebookグループなので、**来る人はほぼ全員Facebookにログイン済み**。
しかもFacebookのアプリ内ブラウザではGoogleログインが動かない（403
disallowed_useragent）ため、そこから来た人にとってはこれが本命の手段になる。

## 検証の要点

⚠️ **アクセストークンを受け取っただけで信用しない。** `debug_token` で
   「うちのアプリ向けに発行されたトークンか」を必ず確かめる。ここを省くと、
   別のアプリで取ったトークンを投げるだけで、そのユーザーになりすませる。
"""
import logging

import requests

import config

logger = logging.getLogger(__name__)

TIMEOUT = 10


class FacebookError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def configured() -> bool:
    return bool(config.META_APP_ID and config.META_APP_SECRET)


def _get(path: str, params: dict) -> dict:
    try:
        res = requests.get(f"{config.META_GRAPH_BASE}{path}", params=params, timeout=TIMEOUT)
    except requests.RequestException as exc:
        logger.error("Graph API に到達できない: %s", type(exc).__name__)
        raise FacebookError("FACEBOOK_UNAVAILABLE", "No pudimos conectar con Facebook.")

    if not res.ok:
        # 応答の中身にトークンが載ることがあるので、そのまま外へ出さない
        logger.error("Graph API エラー: path=%s status=%s", path, res.status_code)
        raise FacebookError("INVALID_FACEBOOK_TOKEN", "No pudimos verificar tu cuenta de Facebook.")

    return res.json()


def verify_token(access_token: str) -> dict:
    """アクセストークンを検証し、プロフィールを返す。

    返すのは {"id", "email", "name", "avatar_url"}。
    """
    if not configured():
        raise FacebookError("FACEBOOK_UNAVAILABLE", "El inicio con Facebook no está disponible.")

    # ① このトークンが**うちのアプリ向け**に発行されたものかを確かめる。
    #    app_id を見ないと、他アプリのトークンでなりすませる
    debug = _get(
        "/debug_token",
        {
            "input_token": access_token,
            "access_token": f"{config.META_APP_ID}|{config.META_APP_SECRET}",
        },
    ).get("data", {})

    if not debug.get("is_valid"):
        raise FacebookError("INVALID_FACEBOOK_TOKEN", "Tu sesión de Facebook no es válida.")
    if str(debug.get("app_id")) != str(config.META_APP_ID):
        logger.error("他アプリのトークンが投げられた: app_id=%s", debug.get("app_id"))
        raise FacebookError("INVALID_FACEBOOK_TOKEN", "Tu sesión de Facebook no es válida.")

    # ② プロフィールを取る
    me = _get("/me", {"fields": "id,name,email", "access_token": access_token})

    if not me.get("id"):
        raise FacebookError("INVALID_FACEBOOK_TOKEN", "No pudimos leer tu cuenta de Facebook.")

    # ⚠️ Facebookはメールを返さないことがある（電話番号だけで登録した人、
    #    メールの権限を拒否した人）。papuntoはメールを前提にしている
    #    （10/1の一斉通知、アカウントの同一性判定、管理画面の検索）ので、
    #    無い場合は作らずに別の手段へ誘導する
    if not me.get("email"):
        raise FacebookError(
            "FACEBOOK_NO_EMAIL",
            "Tu cuenta de Facebook no tiene correo. Entra con Google o con tu correo.",
        )

    return {
        "id": str(me["id"]),
        "email": me["email"].strip().lower(),
        "name": me.get("name"),
        "avatar_url": f"{config.META_GRAPH_BASE}/{me['id']}/picture?type=large",
    }
