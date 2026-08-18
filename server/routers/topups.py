import re
from decimal import Decimal
from typing import NoReturn

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

import config
from database import get_session
from dependencies import get_current_user
from errors import ApiError
from models import TopUp, User
from schemas.topup import OperatorDetectRead, TopUpCreate, TopUpList, TopUpRead
from services import points_service
from services.reloadly_service import ReloadlyError, ReloadlyService

router = APIRouter(prefix="/api/v1/topups", tags=["topups"])

PHONE_PATTERN = re.compile(r"^9\d{8}$")

_ERROR_STATUS = {
    "OPERATOR_NOT_FOUND": 404,
    "RELOADLY_UNAVAILABLE": 502,
    "TOPUP_FAILED": 502,
}


def _raise_reloadly(exc: ReloadlyError) -> NoReturn:
    raise ApiError(_ERROR_STATUS.get(exc.code, 502), exc.code, exc.message)


@router.get("", response_model=TopUpList)
def list_topups(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(TopUp)
        .where(TopUp.user_id == user.id)
        .order_by(TopUp.created_at.desc())
    ).all()
    return TopUpList(topups=[TopUpRead.model_validate(r, from_attributes=True) for r in rows])


@router.get("/operator", response_model=OperatorDetectRead)
def detect_operator(
    phone_number: str,
    user: User = Depends(get_current_user),  # 未認証の乱用防止（Reloadly APIのレート制限保護）
):
    if not PHONE_PATTERN.match(phone_number):
        raise ApiError(422, "INVALID_PHONE", "Número inválido (9 dígitos, empieza con 9)")
    try:
        result = ReloadlyService.detect_operator(phone_number)
    except ReloadlyError as exc:
        _raise_reloadly(exc)
    return OperatorDetectRead(operator_id=result["operator_id"], operator_name=result["operator_name"])


@router.post("", response_model=TopUpRead, status_code=201)
def create_topup(
    body: TopUpCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if not PHONE_PATTERN.match(body.phone_number):
        raise ApiError(422, "INVALID_PHONE", "Número inválido (9 dígitos, empieza con 9)")
    if body.points < config.MIN_WITHDRAWAL_POINTS:
        raise ApiError(422, "BELOW_MINIMUM", f"El mínimo es {config.MIN_WITHDRAWAL_POINTS:,} pts")
    if body.points % config.POINTS_PER_SOL != 0:
        raise ApiError(422, "INVALID_AMOUNT", f"Debe ser múltiplo de {config.POINTS_PER_SOL:,} pts")

    # サーバー側で再度キャリアを検出し直し、クライアント送信のoperator_idと突き合わせる
    # （改ざん対策・番号のキャリアが変わっていた場合の陳腐化対策）
    try:
        detected = ReloadlyService.detect_operator(body.phone_number)
    except ReloadlyError as exc:
        _raise_reloadly(exc)
    if detected["operator_id"] != body.operator_id:
        raise ApiError(
            409, "OPERATOR_MISMATCH",
            "El operador cambió, verifica el número nuevamente antes de continuar",
        )

    # --- フェーズ1: ポイント確認・仮押さえをアトミックに行い、即コミットしてロックを解放 ---
    locked_user = session.exec(select(User).where(User.id == user.id).with_for_update()).one()

    processing = session.exec(
        select(TopUp).where(TopUp.user_id == user.id, TopUp.status == "processing")
    ).first()
    if processing is not None:
        raise ApiError(409, "TOPUP_ALREADY_PROCESSING", "Ya tienes una recarga en proceso")

    if body.points > locked_user.points:
        raise ApiError(422, "INSUFFICIENT_POINTS", "Puntos insuficientes")

    amount_soles = Decimal(body.points // config.POINTS_PER_SOL)
    locked_user.points -= body.points
    topup = TopUp(
        user_id=user.id,
        phone_number=body.phone_number,
        operator_id=detected["operator_id"],
        operator_name=detected["operator_name"],
        points=body.points,
        amount_soles=amount_soles,
        status="processing",
    )
    session.add(topup)
    session.flush()
    points_service.record(
        session,
        user=locked_user,
        points=-body.points,
        kind="topup",
        reference_type="topup",
        reference_id=topup.id,
        note=f"Recarga {detected["operator_name"]}",
    )
    session.commit()  # ここで行ロックを解放。以降は外部API待ちの間DBロックを保持しない
    session.refresh(topup)

    # --- フェーズ2: 外部API呼び出し（DBロックなし） ---
    try:
        result = ReloadlyService.execute_topup(
            phone_number=body.phone_number,
            operator_id=detected["operator_id"],
            amount_soles=amount_soles,
            custom_identifier=str(topup.id),
        )
    except ReloadlyError as exc:
        # --- フェーズ3(失敗時): 新しいトランザクションでポイントを全額戻す ---
        refund_user = session.exec(select(User).where(User.id == user.id).with_for_update()).one()
        refund_user.points += topup.points
        points_service.record(
            session,
            user=refund_user,
            points=topup.points,
            kind="refund",
            reference_type="topup",
            reference_id=topup.id,
            note="Devolución por recarga fallida",
        )
        topup.status = "failed"
        topup.failure_reason = exc.message
        session.add(topup)
        session.commit()
        _raise_reloadly(exc)

    # --- フェーズ3(成功時): 完了ステータスに更新 ---
    topup.status = "completed"
    topup.reloadly_transaction_id = result["transaction_id"]
    session.add(topup)
    session.commit()
    session.refresh(topup)
    return TopUpRead.model_validate(topup, from_attributes=True)
