import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlmodel import Field, SQLModel


class TopUp(SQLModel, table=True):
    """Reloadly経由のペルー携帯キャリア（Claro/Movistar/Entel/Bitel）チャージ交換。"""

    __tablename__ = "topups"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    phone_number: str = Field(max_length=9)
    operator_id: int
    operator_name: str
    points: int  # 消費ポイント数
    amount_soles: Decimal = Field(max_digits=10, decimal_places=2)  # Reloadlyに渡すソル建て金額
    status: str = Field(default="processing")  # processing / completed / failed
    reloadly_transaction_id: Optional[str] = Field(default=None)
    failure_reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
