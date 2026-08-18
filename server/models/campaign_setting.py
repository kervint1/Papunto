from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel

# 行が無いときに使う既定値。マイグレーションの初期投入と揃える。
#
# 環境変数にしないのは、キャンペーン中に変える値だから。
# Heroku の設定変更は再起動を伴い、運用中に何度も触るには重い
DEFAULT_SLOT_LIMIT = 100
DEFAULT_REWARD_POINTS = 500


class CampaignSetting(SQLModel, table=True):
    """事前登録キャンペーンの設定。**常に1行だけ**（id=1）。

    枠数・報酬・交換の開放日は運用中に変わる（枠は100→200に増やす想定、
    開放日はリリースがずれれば動く）ため、管理画面から変えられるようにDBに置く。
    """

    __tablename__ = "campaign_settings"

    id: int = Field(default=1, primary_key=True)

    slot_limit: int = Field(default=DEFAULT_SLOT_LIMIT)
    reward_points: int = Field(default=DEFAULT_REWARD_POINTS)

    # 交換の開放日。NULL は「即座に開放」。
    # ⚠️ 意図せず NULL にすると事前登録中でも交換できてしまうので、
    #    管理画面では空にする操作を確認付きにしている
    withdrawals_open_at: Optional[date] = Field(default=None)

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # 誰が最後に変えたか。金の出入りに効く設定なので追えるようにする
    updated_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")
