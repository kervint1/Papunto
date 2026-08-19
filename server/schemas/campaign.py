from typing import Optional

from pydantic import BaseModel


class CampaignStatus(BaseModel):
    """LPに出す。認証不要"""

    slot_limit: int
    remaining: int
    # 報酬は2段。合計を出したいときは足す
    reward_points_initial: int
    reward_points_bonus: int
    bonus_required_tasks: int
    # 招待の条件。規約ページが実値を描くために返す（告知と実装のずれを防ぐ）
    referral_reward_points: int
    referral_max_per_user: int
    withdrawals_open_at: Optional[str] = None  # ISO日付。未設定なら即開放
    withdrawals_open: bool


class CampaignSlot(BaseModel):
    """ログイン後に出す個別の枠情報"""

    # ⚠️ 登録順の番号（position）は返さない。ユーザーに見せないうえ、
    #    users.id の並び順が推測できてしまうため。管理画面では別途出している
    slot_limit: int
    within_limit: bool
    remaining: int
    phone_registered: bool
    # ⚠️ within_limit ではなく**実際に付与されたか**。枠内でも、キャンペーン開始前に
    # 登録したユーザーは付与されていない。画面の文言はこちらを見る
    reward_granted: bool
    reward_points: int  # 登録時に付与された額。0なら未付与
    # 残りの報酬。タスクを規定数こなすと入る
    bonus_granted: bool
    bonus_points: int
    tasks_completed: int
    bonus_required_tasks: int
