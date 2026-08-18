"""キャンペーン報酬を2段に分ける

一度に500pt渡すと、交換の開放日に引き出して終わりになる。

登録時は300ptだけ渡す。**最低交換額（500pt）に届かない**ので、
タスクを規定数こなさないと1ソルも引き出せない。これが開放日に
戻ってくる動機になり、ASPに見せる成果の実績にもなる。

`campaign_settings.reward_points` を `reward_points_initial` に改名し、
`reward_points_bonus` と `bonus_required_tasks` を足す。
既存の500ptは 300 + 200 に割り直す（合計は変えない）。

Revision ID: b9c4f0a62d17
Revises: a8d3e7f21c05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b9c4f0a62d17"
down_revision: Union[str, None] = "a8d3e7f21c05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "campaign_settings", "reward_points", new_column_name="reward_points_initial"
    )
    op.add_column(
        "campaign_settings",
        sa.Column("reward_points_bonus", sa.Integer(), nullable=False, server_default="200"),
    )
    op.add_column(
        "campaign_settings",
        sa.Column("bonus_required_tasks", sa.Integer(), nullable=False, server_default="1"),
    )
    # 合計は500ptのまま、300 + 200 に割り直す
    op.execute(
        "UPDATE campaign_settings SET reward_points_initial = 300 WHERE reward_points_initial = 500"
    )

    op.add_column(
        "users", sa.Column("campaign_bonus_granted_at", sa.DateTime(), nullable=True)
    )
    op.create_index(
        "ix_users_campaign_bonus_granted_at", "users", ["campaign_bonus_granted_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_users_campaign_bonus_granted_at", table_name="users")
    op.drop_column("users", "campaign_bonus_granted_at")
    op.drop_column("campaign_settings", "bonus_required_tasks")
    op.drop_column("campaign_settings", "reward_points_bonus")
    op.alter_column(
        "campaign_settings", "reward_points_initial", new_column_name="reward_points"
    )
