import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel


class OperatorDetectRead(BaseModel):
    operator_id: int
    operator_name: str


class TopUpCreate(BaseModel):
    phone_number: str
    operator_id: int
    points: int


class TopUpRead(BaseModel):
    id: uuid.UUID
    phone_number: str
    operator_id: int
    operator_name: str
    points: int
    amount_soles: Decimal
    status: str
    created_at: datetime


class TopUpList(BaseModel):
    topups: list[TopUpRead]
