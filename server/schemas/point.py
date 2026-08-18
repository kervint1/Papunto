from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PointTransactionRead(BaseModel):
    id: int
    points: int  # 符号つき。獲得は正、消費は負
    kind: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime


class PointHistory(BaseModel):
    transactions: list[PointTransactionRead]
    # 台帳の合計。残高と一致するはずの値。
    # 画面では出さないが、ずれたときに気づけるよう返しておく
    ledger_total: int
