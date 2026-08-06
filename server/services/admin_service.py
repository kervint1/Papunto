from typing import Any, Optional

from sqlmodel import Session

from models import AdminLog, User


def log_action(
    session: Session,
    *,
    admin: User,
    action: str,
    target_type: str,
    target_id: str,
    detail: Optional[dict[str, Any]] = None,
    note: Optional[str] = None,
) -> AdminLog:
    """管理操作を記録する。

    commitはしない。呼び出し元の業務処理と同じトランザクションに載せることで、
    「操作は通ったのに履歴が残っていない」状態を作らない
    """
    log = AdminLog(
        admin_user_id=admin.id,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        detail=detail or {},
        note=note,
    )
    session.add(log)
    return log
