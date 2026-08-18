from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel

# 行が無いときに使う既定値。マイグレーションの初期投入と揃える。
#
# 環境変数にしないのは、キャンペーン中に変える値だから。
# Heroku の設定変更は再起動を伴い、運用中に何度も触るには重い
DEFAULT_SLOT_LIMIT = 100
# 報酬を2段に割る。**一度に500pt渡すと、交換の開放日に引き出して終わりになる**。
# 300ptは最低交換額（500pt）に届かないので、タスクを1件こなさないと1ソルも
# 引き出せない。これが10/1に戻ってくる動機になる
DEFAULT_REWARD_POINTS_INITIAL = 300
DEFAULT_REWARD_POINTS_BONUS = 200
# 残りを受け取るのに必要なタスクの件数（承認された成果の数）。
# 1件にしているのは、最初の1件で止まった人を全部こぼさないため
DEFAULT_BONUS_REQUIRED_TASKS = 1
# 招待元へ払う報酬。事前登録の500ptより意図的に小さくしている。
# 大きくしすぎると招待そのものが目的になり、リリース後に貯める動機が薄れる
DEFAULT_REFERRAL_REWARD_POINTS = 200
# 1人が受け取れる招待報酬の上限件数。青天井にすると自作自演の被害額に
# 上限が無くなる。正当な拡散を止めない程度に広めに取り、管理画面から変える
DEFAULT_REFERRAL_MAX_PER_USER = 20


class CampaignSetting(SQLModel, table=True):
    """事前登録キャンペーンの設定。**常に1行だけ**（id=1）。

    枠数・報酬・交換の開放日は運用中に変わる（枠は100→200に増やす想定、
    開放日はリリースがずれれば動く）ため、管理画面から変えられるようにDBに置く。
    """

    __tablename__ = "campaign_settings"

    id: int = Field(default=1, primary_key=True)

    slot_limit: int = Field(default=DEFAULT_SLOT_LIMIT)
    # 登録した時点で入る分
    reward_points_initial: int = Field(default=DEFAULT_REWARD_POINTS_INITIAL)
    # タスクをこなしたら入る分
    reward_points_bonus: int = Field(default=DEFAULT_REWARD_POINTS_BONUS)
    bonus_required_tasks: int = Field(default=DEFAULT_BONUS_REQUIRED_TASKS)

    # 交換の開放日。NULL は「即座に開放」。
    # ⚠️ 意図せず NULL にすると事前登録中でも交換できてしまうので、
    #    管理画面では空にする操作を確認付きにしている
    withdrawals_open_at: Optional[date] = Field(default=None)

    referral_reward_points: int = Field(default=DEFAULT_REFERRAL_REWARD_POINTS)
    referral_max_per_user: int = Field(default=DEFAULT_REFERRAL_MAX_PER_USER)

    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    # 誰が最後に変えたか。金の出入りに効く設定なので追えるようにする
    updated_by_user_id: Optional[int] = Field(default=None, foreign_key="users.id")
