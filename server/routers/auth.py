from fastapi import APIRouter, Depends
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlmodel import Session, select

import config
from database import get_session
from errors import ApiError
from models import User
from schemas.auth import LoginRequest, TokenResponse
from services import campaign_service
from services.auth_service import AuthService

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    try:
        info = google_id_token.verify_oauth2_token(
            body.id_token, google_requests.Request(), config.GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise ApiError(401, "INVALID_GOOGLE_TOKEN", "Token de Google inválido")

    user = session.exec(select(User).where(User.google_id == info["sub"])).first()
    if user is None:
        user = User(
            google_id=info["sub"],
            email=info["email"],
            name=info.get("name"),
            avatar_url=info.get("picture"),
        )
        session.add(user)
        # idを確定させてから報酬を付ける（ログに残すidが要るため）
        session.flush()
        # 事前登録キャンペーン。枠が残っていれば登録した時点で付与する。
        # 交換は開放日（/admin/campaign）まで開かないが、残高が増えるのが
        # 見えないと進んでいる実感がないので、付与自体は即時にする
        campaign_service.grant_reward(session, user)
    else:
        user.name = info.get("name") or user.name
        user.avatar_url = info.get("picture") or user.avatar_url
    session.commit()
    session.refresh(user)

    token = AuthService.create_access_token(user.id, user.google_id)
    return TokenResponse(access_token=token)
