import re
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

import config
from database import get_session
from dependencies import get_current_user
from errors import ApiError
from models import User, Withdrawal
from schemas.withdrawal import WithdrawalCreate, WithdrawalList, WithdrawalRead

router = APIRouter(prefix="/api/v1/withdrawals", tags=["withdrawals"])

YAPE_PHONE_PATTERN = re.compile(r"^9\d{8}$")


@router.get("", response_model=WithdrawalList)
def list_withdrawals(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(Withdrawal)
        .where(Withdrawal.user_id == user.id)
        .order_by(Withdrawal.created_at.desc())
    ).all()
    return WithdrawalList(withdrawals=[WithdrawalRead.model_validate(r, from_attributes=True) for r in rows])


@router.post("", response_model=WithdrawalRead, status_code=201)
def create_withdrawal(
    body: WithdrawalCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # 送金先は登録済みの番号を使う。申請ごとの自由入力だと
    # 登録と送金先がずれ、UNIQUE制約を回避できてしまう
    if not user.phone:
        raise ApiError(403, "PHONE_REQUIRED", "Registra tu número de Yape para continuar")
    if not YAPE_PHONE_PATTERN.match(user.phone):
        # 登録時に検証しているので通常は起きない。データ不整合の検知用
        raise ApiError(422, "INVALID_PHONE", "El número registrado no es válido")
    if body.points < config.MIN_WITHDRAWAL_POINTS:
        raise ApiError(422, "BELOW_MINIMUM", f"El mínimo es {config.MIN_WITHDRAWAL_POINTS:,} pts")
    if body.points % config.POINTS_PER_SOL != 0:
        # 端数ソルを発生させないため、1ソル単位でのみ換金を受け付ける
        raise ApiError(422, "INVALID_AMOUNT", f"Debe ser múltiplo de {config.POINTS_PER_SOL:,} pts")

    # 行ロックで並行申請を防ぐ
    locked_user = session.exec(
        select(User).where(User.id == user.id).with_for_update()
    ).one()

    pending = session.exec(
        select(Withdrawal).where(
            Withdrawal.user_id == user.id, Withdrawal.status == "pending"
        )
    ).first()
    if pending is not None:
        raise ApiError(409, "WITHDRAWAL_ALREADY_PENDING", "Ya tienes una solicitud en proceso")

    if body.points > locked_user.points:
        raise ApiError(422, "INSUFFICIENT_POINTS", "Puntos insuficientes")

    locked_user.points -= body.points
    withdrawal = Withdrawal(
        user_id=user.id,
        # 申請時点の送金先を記録として残す（後で番号が変わっても履歴は動かさない）
        yape_phone=user.phone,
        points=body.points,
        amount_soles=Decimal(body.points // config.POINTS_PER_SOL),
    )
    session.add(withdrawal)
    session.commit()
    session.refresh(withdrawal)
    return WithdrawalRead.model_validate(withdrawal, from_attributes=True)
