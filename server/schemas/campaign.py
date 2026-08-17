from typing import Optional

from pydantic import BaseModel


class CampaignStatus(BaseModel):
    """LPに出す。認証不要"""

    slot_limit: int
    remaining: int
    reward_points: int
    withdrawals_open_at: Optional[str] = None  # ISO日付。未設定なら即開放
    withdrawals_open: bool


class CampaignSlot(BaseModel):
    """ログイン後に出す個別の枠情報"""

    position: int  # 登録順の番号
    slot_limit: int
    within_limit: bool
    remaining: int
    phone_registered: bool
