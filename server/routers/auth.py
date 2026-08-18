"""ログイン。

ログイン手段ごとに**本人確認の方法だけ**が違い、ユーザーの作成・紐づけは
`identity_service.resolve_user()` に集約する。

⚠️ Facebookのアプリ内ブラウザでは **Googleログインが動かない**
   （Googleが埋め込みWebViewでのOAuthを拒否する。403 disallowed_useragent。
   こちらの設定では回避できない）。集客がFacebookグループなので、
   Google以外の手段が無いと入口で止まる。
"""
from fastapi import APIRouter, Depends
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlmodel import Session

import config
from database import get_session
from errors import ApiError
from schemas.auth import LoginRequest, TokenResponse
from services import identity_service
from services.auth_service import AuthService

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
