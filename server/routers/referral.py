"""招待（リファラル）。

招待コードの発行・共有と、招待された側からのコード適用。

コードはOAuthの往復では引き回さない。LPで受け取った `?ref=` を
フロントが保持しておき、**ログイン後に改めて /claim を叩く**。
OAuthのstateに載せるより経路が単純で、ログイン方法が増えても壊れない。
"""
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

import config
from database import get_session
from dependencies import get_current_user
from errors import ApiError
from models import User
from schemas.referral import ReferralCheck, ReferralClaim, ReferralClaimResult, ReferralMe
from services import campaign_service, referral_service

router = APIRouter(prefix="/api/v1/referral", tags=["referral"])

_ERROR_STATUS = {
    "INVALID_CODE": 422,
    "CODE_NOT_FOUND": 404,
    "SELF_REFERRAL": 400,
    "ALREADY_INVITED": 409,
    "CLAIM_WINDOW_CLOSED": 409,
}


@router.get("/check", response_model=ReferralCheck)
def check_code(
    code: str = Query(..., max_length=32),
    session: Session = Depends(get_session),
):
    """コードが有効かをログイン前に確かめる。**認証不要**。

    登録の前に「誰の招待か」を見せて安心させるための経路。
    存在しないコードでも 404 にせず valid=false を返す（画面で扱いやすい）。
    """
    inviter = referral_service.find_by_code(session, code)
    return ReferralCheck(
        valid=inviter is not None,
        inviter_name=referral_service.first_name(inviter) if inviter else None,
    )


@router.get("", response_model=ReferralMe)
def get_my_referral(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    code = referral_service.ensure_code(session, user)
    settings = campaign_service.get_settings(session)
    inviter = referral_service.invited_by(session, user)
    return ReferralMe(
        code=code,
        share_url=f"{config.FRONTEND_ORIGIN}/?ref={code}",
        reward_points=settings.referral_reward_points,
        total=referral_service.total_count(session, user),
        settled=referral_service.settled_count(session, user),
        earned_points=referral_service.earned_points(session, user),
        max_per_user=settings.referral_max_per_user,
        pending=referral_service.total_count(session, user)
        - referral_service.settled_count(session, user),
        required_earnings=settings.referral_required_earnings,
        invited_by=inviter.name if inviter else None,
        can_claim=inviter is None and referral_service.within_claim_window(user),
    )


@router.post("/claim", response_model=ReferralClaimResult)
def claim_referral(
    body: ReferralClaim,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    try:
        referral = referral_service.claim(session, user, body.code)
    except referral_service.ReferralError as e:
        raise ApiError(_ERROR_STATUS.get(e.code, 400), e.code, e.message)

    inviter = session.get(User, referral.inviter_user_id)
    return ReferralClaimResult(claimed=True, inviter_name=inviter.name if inviter else None)
