"""ログイン。

ログイン手段ごとに**本人確認の方法だけ**が違い、ユーザーの作成・紐づけは
`identity_service.resolve_user()` に集約する。

⚠️ Facebookのアプリ内ブラウザでは **Googleログインが動かない**
   （Googleが埋め込みWebViewでのOAuthを拒否する。403 disallowed_useragent。
   こちらの設定では回避できない）。集客がFacebookグループなので、
   Google以外の手段が無いと入口で止まる。
"""
import logging

from fastapi import APIRouter, Depends
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlmodel import Session

import config
from database import get_session
from errors import ApiError
from schemas.auth import FacebookLoginRequest, LoginRequest, TokenResponse
from schemas.magic_link import MagicLinkRequest, MagicLinkRequestResult, MagicLinkVerify
from services import (
    facebook_service,
    identity_service,
    magic_link_service,
    mail_service,
)
from services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    """GoogleのIDトークンでログインする。

    パスは互換のため `/login` のまま残す（フロントとネイティブが叩いている）。
    """
    try:
        info = google_id_token.verify_oauth2_token(
            body.id_token, google_requests.Request(), config.GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise ApiError(401, "INVALID_GOOGLE_TOKEN", "Token de Google inválido")

    # Googleは検証済みのメールを返すので、メールでの紐づけに使ってよい
    user = identity_service.resolve_user(
        session,
        provider=identity_service.PROVIDER_GOOGLE,
        provider_user_id=info["sub"],
        email=info["email"],
        name=info.get("name"),
        avatar_url=info.get("picture"),
    )
    session.commit()
    session.refresh(user)

    return TokenResponse(access_token=AuthService.create_access_token(user.id))


# ---------------------------------------------------- メールのマジックリンク

@router.post("/magic-link", response_model=MagicLinkRequestResult)
def request_magic_link(body: MagicLinkRequest, session: Session = Depends(get_session)):
    """ログイン用のリンクをメールで送る。登録も兼ねる。

    ⚠️ 成否にかかわらず同じ応答を返す（存在するメールかを判別させない）。
       ただし送信の失敗だけは返す。届いていないのに「送った」と言うと、
       ユーザーが待ち続けることになる。
    """
    email = str(body.email).strip().lower()

    try:
        raw = magic_link_service.issue(session, email)
    except magic_link_service.MagicLinkError as e:
        raise ApiError(429, e.code, e.message)

    url = magic_link_service.build_url(raw)

    if mail_service.configured():
        try:
            mail_service.send(
                to=email,
                subject="Tu enlace para entrar a Papunto",
                body=(
                    "Toca el enlace para entrar a tu cuenta:\n\n"
                    f"{url}\n\n"
                    "El enlace vence en 15 minutos y solo se puede usar una vez.\n"
                    "Si no lo pediste, ignora este correo."
                ),
            )
        except mail_service.MailError:
            raise ApiError(503, "MAIL_FAILED", "No pudimos enviar el correo. Inténtalo de nuevo.")
    elif config.MAGIC_LINK_DEV_ECHO:
        # 開発用。本番で有効にするとログを見られる人が誰でもログインできる
        logger.warning("MAGIC LINK (dev echo): %s", url)
    else:
        raise ApiError(503, "MAIL_UNAVAILABLE", "El inicio con correo no está disponible.")

    return MagicLinkRequestResult()


@router.post("/magic-link/verify", response_model=TokenResponse)
def verify_magic_link(body: MagicLinkVerify, session: Session = Depends(get_session)):
    try:
        email = magic_link_service.consume(session, body.token)
    except magic_link_service.MagicLinkError as e:
        raise ApiError(401, e.code, e.message)

    # リンクを受け取れた時点でメールの所有が確認できている。
    # 同じメールの既存ユーザーがいればそちらへ紐づけてよい
    user = identity_service.resolve_user(
        session,
        provider=identity_service.PROVIDER_EMAIL,
        provider_user_id=email,
        email=email,
    )
    session.commit()
    session.refresh(user)

    return TokenResponse(access_token=AuthService.create_access_token(user.id))


# ---------------------------------------------------------- Facebookログイン

@router.post("/facebook", response_model=TokenResponse)
def login_facebook(body: FacebookLoginRequest, session: Session = Depends(get_session)):
    """Facebookのアクセストークンでログインする。

    集客がFacebookグループなので、**そこから来た人にとってはこれが本命**。
    Facebookのアプリ内ブラウザではGoogleログインが動かない。
    """
    try:
        profile = facebook_service.verify_token(body.access_token)
    except facebook_service.FacebookError as e:
        status = 503 if e.code == "FACEBOOK_UNAVAILABLE" else 401
        # メールが無いのは利用者側の状態なので、401ではなく422で返す
        if e.code == "FACEBOOK_NO_EMAIL":
            status = 422
        raise ApiError(status, e.code, e.message)

    # Facebookが返すメールは検証済み。メールでの紐づけに使ってよい
    user = identity_service.resolve_user(
        session,
        provider=identity_service.PROVIDER_FACEBOOK,
        provider_user_id=profile["id"],
        email=profile["email"],
        name=profile.get("name"),
        avatar_url=profile.get("avatar_url"),
    )
    session.commit()
    session.refresh(user)

    return TokenResponse(access_token=AuthService.create_access_token(user.id))
