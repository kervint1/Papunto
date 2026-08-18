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
    # ⚠️ within_limit ではなく**実際に付与されたか**。枠内でも、キャンペーン開始前に
    # 登録したユーザーは付与されていない。画面の文言はこちらを見る
    reward_granted: bool
    reward_points: int  # 付与された額。0なら未付与
