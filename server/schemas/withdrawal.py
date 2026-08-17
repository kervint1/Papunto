import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class WithdrawalCreate(BaseModel):
    # 送金先は users.phone を使うので受け取らない
    points: int


class WithdrawalRead(BaseModel):
    id: uuid.UUID
    yape_phone: str
    points: int
    amount_soles: Decimal
    status: str
    created_at: datetime


class WithdrawalList(BaseModel):
    withdrawals: list[WithdrawalRead]
