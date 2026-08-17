"""users.campaign_reward_granted_at を追加

事前登録キャンペーンの報酬をいつ付与したか。

二重付与の防止と、誰が対象になったかを後から追うために持つ。
金が動く処理なので「付与したか」をフラグではなく時刻で残す
（いつ付与したかが分かると、問い合わせ対応で辿れる）。

既存ユーザーはキャンペーン開始前の登録なので NULL のままでよい。

Revision ID: c5d9e3f81a26
Revises: b4c8d2e70f15
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c5d9e3f81a26"
down_revision: Union[str, None] = "b4c8d2e70f15"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("campaign_reward_granted_at", sa.DateTime(), nullable=True),
    )
    # 付与済みの人数を数えるのに使う（枠の判定）
    op.create_index(
        "ix_users_campaign_reward_granted_at",
        "users",
        ["campaign_reward_granted_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_users_campaign_reward_granted_at", table_name="users")
    op.drop_column("users", "campaign_reward_granted_at")
