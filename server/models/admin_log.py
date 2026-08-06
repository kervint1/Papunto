import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class AdminLog(SQLModel, table=True):
    """管理画面からの操作履歴。

    換金の承認・却下はお金が動くうえ取り消せないため、「誰がいつ何をしたか」を必ず残す。
    DBクライアントで直接UPDATEしていた頃は履歴が一切残らなかった。
    """

    __tablename__ = "admin_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    admin_user_id: int = Field(foreign_key="users.id", index=True)
    action: str = Field(index=True)  # withdrawal.approve / withdrawal.reject / complaint.respond
    target_type: str  # withdrawal / complaint / user
    target_id: str  # UUIDや整数IDを文字列で持つ（対象テーブルによって型が違うため）
    # 操作時点のスナップショット（金額・変更前後のステータスなど）。後から差分を追えるようにする
    detail: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    note: Optional[str] = Field(default=None)  # 却下理由などの自由記述
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
