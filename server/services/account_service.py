"""退会（アカウント削除）。

**Google Play は、アカウントを作れるアプリに削除手段を義務づけている**
（2024年4月15日から完全施行）。アプリ内の導線に加えて、アプリを入れ直さずに
削除を要求できる**WebのURL**も要る。プライバシーポリシーでも
「Borrar o eliminar sus Datos Personales」と約束している。

物理削除はしない。ポイントの台帳・成果・換金の記録が user_id で刺さっており、
行ごと消すと会計が壊れて過去の支払いを説明できなくなる。代わりに個人が
特定できる値を落とし、UNIQUE制約を空ける。
"""
import hashlib
import hmac
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session, select

import config
from errors import ApiError
from models import User, Withdrawal
from services import points_service

logger = logging.getLogger(__name__)

# 退会後のメールに付けるドメイン。実在しないTLDなので、間違って送信しても
# 誰にも届かない（RFC 2606 の .invalid）
DELETED_EMAIL_DOMAIN = "deleted.invalid"


def hash_phone(phone: str) -> str:
    """電話番号のハッシュ。サーバー側の秘密を鍵にする。

    ⚠️ 単純なsha256にしない。ペルーの携帯番号は9桁固定（`^9\\d{8}$`）で
       探索空間が1億しかなく、DBが漏れたら総当たりで即座に復元される。
       HMACにして鍵を分けることで、DBだけでは戻せないようにする。
    """
    return hmac.new(
        config.SECRET_KEY.encode(), phone.strip().encode(), hashlib.sha256
    ).hexdigest()


def campaign_already_claimed(session: Session, phone: str) -> bool:
    """この電話番号で、過去に事前登録の報酬を受け取っているか。

    退会済みユーザーだけを見る。現役ユーザーは `users.phone` のUNIQUEで
    そもそも同じ番号を登録できない。
    """
    row = session.exec(
        select(User)
        .where(User.phone_hash == hash_phone(phone))
        .where(User.deleted_at.is_not(None))
        .where(User.campaign_reward_granted_at.is_not(None))
    ).first()
    return row is not None


def delete_account(session: Session, user: User, *, reason: Optional[str] = None) -> None:
    """退会させる。commitは呼び出し側で行う。

    ⚠️ 送金の申請が残っているうちは退会させない。申請時点でポイントを
       引いてあるので、ここで消すと**送るべき金額の記録だけが宙に浮く**。
    """
    if user.deleted_at is not None:
        raise ApiError(409, "ALREADY_DELETED", "Esta cuenta ya fue eliminada")

    pending = session.exec(
        select(Withdrawal)
        .where(Withdrawal.user_id == user.id)
        .where(Withdrawal.status == "pending")
    ).first()
    if pending is not None:
        raise ApiError(
            409,
            "WITHDRAWAL_PENDING",
            "Tienes un canje en proceso. Espera a que se complete antes de eliminar tu cuenta.",
        )

    now = datetime.now(timezone.utc)

    # 番号を消す前にハッシュを残す。順番を逆にすると復元できない
    if user.phone:
        user.phone_hash = hash_phone(user.phone)

    # 残ったポイントは失効する。台帳に書かないと
    # sum(point_transactions) == users.points の不変条件が壊れる
    if user.points:
        points_service.record(
            session,
            user=user,
            points=-user.points,
            kind="account_deleted",
            note="Cuenta eliminada por el usuario",
        )
        user.points = 0

    # UNIQUE制約を空ける。空けないと同じメール・同じ番号で再登録できない
    user.email = f"deleted+{user.id}@{DELETED_EMAIL_DOMAIN}"
    user.phone = None
    user.referral_code = None
    # ログイン経路の紐づけを外す。残すと同じGoogleアカウントで入り直せない
    user.provider_user_id = f"deleted-{user.id}"
    user.name = None
    user.avatar_url = None
    # 管理者のまま退会されると、復活させたときに権限が残る
    user.is_admin = False
    user.deleted_at = now
    session.add(user)

    logger.info("退会: user=%s reason=%s", user.id, reason or "-")
