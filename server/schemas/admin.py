import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel


class Page(BaseModel):
    """一覧の共通ページング情報"""

    page: int
    per_page: int
    total: int


class AdminStats(BaseModel):
    users_total: int
    users_new_7d: int
    points_outstanding: int  # 全ユーザーの保有ポイント合計（＝将来の支払い債務）
    withdrawals_pending: int
    topups_processing: int
    complaints_pendientes: int
    postbacks_pending: int
    postback_logs_unverified_7d: int


class AdminUserRead(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    points: int
    is_admin: bool
    created_at: datetime


class AdminUserList(BaseModel):
    users: list[AdminUserRead]
    page: Page


class AdminWithdrawalRead(BaseModel):
    id: uuid.UUID
    user_id: int
    user_email: Optional[str] = None
    yape_phone: str
    points: int
    amount_soles: Decimal
    status: str
    created_at: datetime
    updated_at: datetime


class AdminWithdrawalList(BaseModel):
    withdrawals: list[AdminWithdrawalRead]
    page: Page


class WithdrawalActionBody(BaseModel):
    note: Optional[str] = None


class AdminPostbackRead(BaseModel):
    id: uuid.UUID
    provider: str
    transaction_id: str
    user_id: int
    user_email: Optional[str] = None
    reward_points: int
    payout_usd: Optional[Decimal] = None
    campaign_name: Optional[str] = None
    status: str
    created_at: datetime


class AdminPostbackList(BaseModel):
    postbacks: list[AdminPostbackRead]
    page: Page


class AdminPostbackLogRead(BaseModel):
    id: uuid.UUID
    provider: str
    transaction_id: Optional[str] = None
    http_method: str
    verified: bool
    remote_ip: str
    received_at: datetime
    params: dict[str, Any]


class AdminPostbackLogList(BaseModel):
    logs: list[AdminPostbackLogRead]
    page: Page


class AdminTopUpRead(BaseModel):
    id: uuid.UUID
    user_id: int
    user_email: Optional[str] = None
    phone_number: str
    operator_name: str
    points: int
    amount_soles: Decimal
    status: str
    failure_reason: Optional[str] = None
    created_at: datetime


class AdminTopUpList(BaseModel):
    topups: list[AdminTopUpRead]
    page: Page


class AdminComplaintRead(BaseModel):
    id: uuid.UUID
    number: Optional[int] = None
    tipo: str
    consumidor_nombre: str
    consumidor_email: str
    consumidor_telefono: Optional[str] = None
    bien_tipo: str
    bien_descripcion: str
    monto_reclamado: Optional[Decimal] = None
    detalle: str
    pedido: str
    status: str
    created_at: datetime


class AdminComplaintList(BaseModel):
    complaints: list[AdminComplaintRead]
    page: Page


class AdminLogRead(BaseModel):
    id: uuid.UUID
    admin_user_id: int
    admin_email: Optional[str] = None
    action: str
    target_type: str
    target_id: str
    detail: dict[str, Any]
    note: Optional[str] = None
    created_at: datetime


class AdminLogList(BaseModel):
    logs: list[AdminLogRead]
    page: Page


class AdminUserDetail(BaseModel):
    user: AdminUserRead
    postbacks: list[AdminPostbackRead]
    withdrawals: list[AdminWithdrawalRead]
    topups: list[AdminTopUpRead]
