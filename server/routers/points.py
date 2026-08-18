"""ポイントの履歴。

`users.points` が動いた理由をすべて返す。オファーウォールの成果だけを
出していた頃は、キャンペーン報酬と招待報酬が**残高だけ増えて履歴に出ない**
状態になっていた。
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session

from database import get_session
from dependencies import get_current_user
from models import User
from schemas.point import PointHistory, PointTransactionRead
from services import points_service

router = APIRouter(prefix="/api/v1/points", tags=["points"])


@router.get("", response_model=PointHistory)
def get_history(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = points_service.history(session, user)
    return PointHistory(
        transactions=[
            PointTransactionRead.model_validate(r, from_attributes=True) for r in rows
        ],
        ledger_total=points_service.ledger_total(session, user),
    )
