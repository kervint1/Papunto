"""ポイント台帳。

`users.points` を動かす処理は、**必ず** `record()` を通す。
残高だけを足し引きすると、増えた理由が画面に出せなくなる。
"""
import logging
from typing import Optional

from sqlmodel import Session, func, select

from models import PointTransaction, User

logger = logging.getLogger(__name__)


def record(
    session: Session,
    *,
    user: User,
    points: int,
    kind: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    note: Optional[str] = None,
) -> PointTransaction:
    """台帳に1行書く。**残高の更新はしない**。

    残高の更新と同じトランザクションで呼ぶこと。commitもしない
    （呼び出し元の業務処理に載せることで、片方だけ残る状態を作らない）。

    残高を触らないのは、既存の処理が行ロックを取った上で加算している箇所が
    あり、ここで二重に触ると意図がぼやけるため。責務は「記録」だけに絞る。
    """
    tx = PointTransaction(
        user_id=user.id,
        points=points,
        kind=kind,
        reference_type=reference_type,
        reference_id=str(reference_id) if reference_id is not None else None,
        note=note,
    )
    session.add(tx)
    return tx


def history(session: Session, user: User) -> list[PointTransaction]:
    return list(
        session.exec(
            select(PointTransaction)
            .where(PointTransaction.user_id == user.id)
            .order_by(PointTransaction.created_at.desc(), PointTransaction.id.desc())
        ).all()
    )


def ledger_total(session: Session, user: User) -> int:
    """台帳の合計。残高との突き合わせに使う（管理画面・調査用）"""
    return int(
        session.exec(
            select(func.coalesce(func.sum(PointTransaction.points), 0)).where(
                PointTransaction.user_id == user.id
            )
        ).one()
    )
