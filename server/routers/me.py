from fastapi import APIRouter, Depends

import config
from dependencies import get_current_user
from models import User
from schemas.user import MeResponse

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
        min_withdrawal_points=config.MIN_WITHDRAWAL_POINTS,
        points_per_sol=config.POINTS_PER_SOL,
    )
