import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

# 成果の状態。オファーウォールは「未承認で通知 → 後日まとめて承認/否認」という流れを取るため、
# 承認だけを扱うと否認・巻き戻し（利用規約にも条項あり）に対応できない
STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
TERMINAL_STATUSES = (STATUS_APPROVED, STATUS_REJECTED)


class Postback(SQLModel, table=True):
    """オファーウォール（Monlix / CPALead）から届いた成果1件。"""

    __tablename__ = "postbacks"
    # 取引IDは提供元ごとの採番なので、提供元をまたぐと衝突しうる。
    # transaction_id単独のUNIQUEではなく複合にする
    __table_args__ = (
        UniqueConstraint("provider", "transaction_id", name="uq_postbacks_provider_transaction_id"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    provider: str = Field(default="monlix", index=True)  # monlix / cpalead
    transaction_id: str = Field(index=True)  # 提供元の取引ID（二重付与防止の冪等キー）
    user_id: int = Field(foreign_key="users.id", index=True)
    reward_points: int  # 獲得ポイント数（換算後）
    # 換算前の原資額。reward_pointsは換算レート適用後の値なので、レートを変えると
    # 過去分の検証ができなくなる。整数で持つと小数以下が落ちるためDecimalで保持する
    payout_usd: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=4)
    campaign_id: Optional[str] = Field(default=None)
    campaign_name: Optional[str] = Field(default=None)  # 履歴で「どの案件で得たか」を示す
    status: str = Field(default=STATUS_PENDING, index=True)
    approved_at: Optional[datetime] = Field(default=None)
    rejected_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
