"""事前登録キャンペーンの状態。

`/status` は**認証不要**。LPに「残り63枠」を出すため。
希少性が拡散の動機になるので、ログイン前に見せる必要がある。

`/me` はログイン後に「あなたは37人目です」を返す。
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session

import config
from database import get_session
from dependencies import get_current_user
from models import User
from schemas.campaign import CampaignSlot, CampaignStatus
from services import campaign_service

router = APIRouter(prefix="/api/v1/campaign", tags=["campaign"])


@router.get("/status", response_model=CampaignStatus)
def get_status(session: Session = Depends(get_session)):
    opens = campaign_service.withdrawals_open_at()
    return CampaignStatus(
        slot_limit=config.CAMPAIGN_SLOT_LIMIT,
        remaining=campaign_service.remaining_slots(session),
        reward_points=config.CAMPAIGN_REWARD_POINTS,
        withdrawals_open_at=opens.isoformat() if opens else None,
        withdrawals_open=campaign_service.withdrawals_open(),
    )


@router.get("/me", response_model=CampaignSlot)
def get_my_slot(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    slot = campaign_service.slot_of(session, user)
    return CampaignSlot(
        position=slot.position,
        slot_limit=slot.limit,
        within_limit=slot.within_limit,
        remaining=slot.remaining,
        phone_registered=bool(user.phone),
    )
