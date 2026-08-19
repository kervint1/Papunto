"""事前登録キャンペーンの状態。

`/status` は**認証不要**。LPに「残り63枠」を出すため。
希少性が拡散の動機になるので、ログイン前に見せる必要がある。

`/me` はログイン後に「あなたは37人目です」を返す。
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user
from models import User
from schemas.campaign import CampaignSlot, CampaignStatus
from services import campaign_service

router = APIRouter(prefix="/api/v1/campaign", tags=["campaign"])


@router.get("/status", response_model=CampaignStatus)
def get_status(session: Session = Depends(get_session)):
    settings = campaign_service.get_settings(session)
    opens = settings.withdrawals_open_at
    return CampaignStatus(
        slot_limit=settings.slot_limit,
        remaining=campaign_service.remaining_slots(session),
        reward_points_initial=settings.reward_points_initial,
        reward_points_bonus=settings.reward_points_bonus,
        bonus_required_tasks=settings.bonus_required_tasks,
        referral_reward_points=settings.referral_reward_points,
        referral_max_per_user=settings.referral_max_per_user,
        withdrawals_open_at=opens.isoformat() if opens else None,
        withdrawals_open=campaign_service.withdrawals_open(session),
    )


@router.get("/me", response_model=CampaignSlot)
def get_my_slot(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    slot = campaign_service.slot_of(session, user)
    settings = campaign_service.get_settings(session)
    done, required = campaign_service.bonus_progress(session, user)
    return CampaignSlot(
        slot_limit=slot.limit,
        within_limit=slot.within_limit,
        remaining=slot.remaining,
        phone_registered=bool(user.phone),
        reward_granted=user.campaign_reward_granted_at is not None,
        reward_points=(
            settings.reward_points_initial
            if user.campaign_reward_granted_at is not None
            else 0
        ),
        bonus_granted=user.campaign_bonus_granted_at is not None,
        bonus_points=(
            settings.reward_points_bonus
            if user.campaign_bonus_granted_at is not None
            else 0
        ),
        tasks_completed=done,
        bonus_required_tasks=required,
    )
