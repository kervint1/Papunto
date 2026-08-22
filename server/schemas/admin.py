import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field


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
    posts_draft: int = 0

    # 外部連携が「開発用の設定」のまま本番に出ていないかを、管理画面を開くたびに
    # 目に入る形で出す。切り替え忘れはエラーにならないので、気づく手段が要る
    cpalead_mock: bool = True
    reloadly_sandbox: bool = True


class AdminUserRead(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    # 送金先。不正調査（同じ番号での重複登録）でいちばん見る値
    phone: Optional[str] = None
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


class AdminPointTransactionRead(BaseModel):
    id: int
    points: int  # 符号つき。獲得は正、消費は負
    kind: str
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime


class AdminUserCampaign(BaseModel):
    """キャンペーン報酬の状況。2段のどこまで進んだかを見る"""

    position: int  # 登録順の番号
    within_limit: bool
    reward_granted_at: Optional[datetime] = None  # 初回分
    bonus_granted_at: Optional[datetime] = None  # タスク後の残り
    tasks_completed: int
    bonus_required_tasks: int
    # 先着枠の対象外か。管理者や検証用のアカウントを外すために使う
    excluded: bool


class CampaignExclusionUpdate(BaseModel):
    excluded: bool


class AdminUserReferral(BaseModel):
    """招待の状況。自作自演を疑ったときに辿る"""

    code: Optional[str] = None
    invited_by_email: Optional[str] = None  # 誰の招待で入ったか
    invited_by_user_id: Optional[int] = None
    invited_total: int  # 紐づいた人数
    invited_settled: int  # 成立した人数
    earned_points: int


class AdminUserDetail(BaseModel):
    user: AdminUserRead
    postbacks: list[AdminPostbackRead]
    withdrawals: list[AdminWithdrawalRead]
    topups: list[AdminTopUpRead]

    point_transactions: list[AdminPointTransactionRead]
    # ⚠️ 台帳の合計。`user.points` と一致するはず。
    #    ずれていたら、台帳を書かずに残高を動かした経路がある
    ledger_total: int
    campaign: AdminUserCampaign
    referral: AdminUserReferral


class AdminCampaignSettings(BaseModel):
    """事前登録キャンペーンの設定（管理画面で編集する）"""

    slot_limit: int
    reward_points_initial: int
    reward_points_bonus: int
    bonus_required_tasks: int
    withdrawals_open_at: Optional[date] = None  # NULL は即座に開放
    referral_reward_points: int
    referral_max_per_user: int
    referral_required_earnings: int
    updated_at: Optional[datetime] = None
    updated_by_email: Optional[str] = None

    # 保存の前に影響を見せるための現況。設定と一緒に返す
    granted_count: int  # 付与済みの人数（＝消費済みの枠）
    users_total: int


class AdminCampaignSettingsUpdate(BaseModel):
    # 枠を付与済み人数より小さくすると残り枠が0のまま止まるので、
    # 下限は1にしておき、実際の整合はルーター側で見る
    slot_limit: int = Field(ge=1, le=100000)
    reward_points_initial: int = Field(ge=0, le=100000)
    reward_points_bonus: int = Field(ge=0, le=100000)
    # 0にすると誰もボーナスを取れなくなるので下限を1にする
    bonus_required_tasks: int = Field(ge=1, le=100)
    withdrawals_open_at: Optional[date] = None
    referral_reward_points: int = Field(ge=0, le=100000)
    referral_max_per_user: int = Field(ge=1, le=10000)
    # 0にすると登録しただけで成立し、メールを量産するだけで報酬が積み上がる。
    # 下限を1にして、必ずタスクの実績を要求する
    referral_required_earnings: int = Field(ge=1, le=1000000)
    # 開放日を空にする（＝即座に開放する）ときだけ必須。
    # 事前登録中に誤って開放するのを一段止める
    confirm_open_now: bool = False
