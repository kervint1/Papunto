import logging

from fastapi import APIRouter, Depends
from sqlmodel import Session

import config
from database import get_session
from dependencies import get_current_user
from models import User
from schemas.user import DeleteAccountBody, MeResponse
from services import account_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["me"])


@router.get("/me", response_model=MeResponse)
def get_me(user: User = Depends(get_current_user)):
    return MeResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        points=user.points,
        is_admin=user.is_admin,
        phone_registered=bool(user.phone),
        min_withdrawal_points=config.MIN_WITHDRAWAL_POINTS,
        points_per_sol=config.POINTS_PER_SOL,
    )


@router.delete("/me", status_code=204)
def delete_me(
    body: DeleteAccountBody | None = None,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """自分のアカウントを削除する。

    **Google Play はアカウントを作れるアプリに削除手段を義務づけている**
    （2024年4月15日から完全施行）。アプリ内の導線と、アプリを入れ直さずに
    要求できるWebのURLの両方が要る。ここは両方から呼ばれる。
    """
    account_service.delete_account(session, user, reason=body.reason if body else None)
    session.commit()
    return None
