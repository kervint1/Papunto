"""電話番号の登録。

Yapeの送金先であり、キャンペーンの参加条件でもある。

⚠️ 一度登録したら変更させない。変更を許すと、1つの番号を使い回して
   複数アカウントで報酬を受け取れてしまう（登録→受取→番号を外す→別アカウントで再登録）。
   誤登録の救済は管理画面から行う。
"""
import logging
import re

from fastapi import APIRouter, Depends
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from database import get_session
from dependencies import get_current_user
from errors import ApiError
from models import User
from schemas.phone import PhoneRegister, PhoneStatus
from services import referral_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/phone", tags=["phone"])

# ペルーの携帯番号。9で始まる9桁（withdrawals と同じ規則に揃える）
PHONE_PATTERN = re.compile(r"^9\d{8}$")


@router.get("", response_model=PhoneStatus)
def get_phone(user: User = Depends(get_current_user)):
    return PhoneStatus(registered=bool(user.phone), phone=user.phone)


@router.post("", response_model=PhoneStatus)
def register_phone(
    body: PhoneRegister,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    phone = body.phone.strip()
    if not PHONE_PATTERN.match(phone):
        raise ApiError(422, "INVALID_PHONE", "Número de Yape inválido (9 dígitos, empieza con 9)")

    if user.phone:
        # 変更は塞ぐ。許すと1つの番号を複数アカウントで使い回せる
        if user.phone == phone:
            return PhoneStatus(registered=True, phone=user.phone)
        raise ApiError(
            409,
            "PHONE_ALREADY_SET",
            "Ya tienes un número registrado. Escríbenos si necesitas cambiarlo.",
        )

    # 事前に確認して分かりやすいエラーを返す。ただし並行登録は
    # すり抜けるので、下のIntegrityErrorが最終的な砦になる
    taken = session.exec(select(User).where(User.phone == phone)).first()
    if taken is not None:
        raise ApiError(409, "PHONE_TAKEN", "Este número ya está registrado en otra cuenta")

    locked = session.exec(select(User).where(User.id == user.id).with_for_update()).one()
    locked.phone = phone
    session.add(locked)
    try:
        session.commit()
    except IntegrityError:
        # 同じ番号で同時に登録された場合。UNIQUE制約が効いた
        session.rollback()
        logger.info("phone already taken (race): user=%s", user.id)
        raise ApiError(409, "PHONE_TAKEN", "Este número ya está registrado en otra cuenta")

    session.refresh(locked)
    logger.info("phone registered: user=%s", locked.id)

    # 交換が開いた後は、電話番号の登録が招待の成立条件になる。
    # ここで試さないと、条件を満たしても誰も成立させる人がいない
    if referral_service.settle_for_invitee(session, locked):
        session.commit()

    return PhoneStatus(registered=True, phone=locked.phone)
