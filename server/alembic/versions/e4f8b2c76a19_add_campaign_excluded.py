"""users.campaign_excluded を追加

管理者や検証用のアカウントが先着100名の枠を消費しないようにする。

⚠️ is_admin では代用できない。管理者フラグは**登録の後に**付けるので、
   その時点では既に付与が済んでいる。除外は明示的なフラグで持つ。

既存の管理者は除外にしておく（すでに枠を消費しているため）。
付与済みポイントの取り消しは管理画面から行う（台帳に記録を残すため、
ここではデータを書き換えない）。

Revision ID: e4f8b2c76a19
Revises: d2e6c9a15b83
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e4f8b2c76a19"
down_revision: Union[str, None] = "d2e6c9a15b83"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "campaign_excluded", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.create_index("ix_users_campaign_excluded", "users", ["campaign_excluded"])
    # 既存の管理者は枠を消費しているので除外にする
    op.execute("UPDATE users SET campaign_excluded = true WHERE is_admin = true")


def downgrade() -> None:
    op.drop_index("ix_users_campaign_excluded", table_name="users")
    op.drop_column("users", "campaign_excluded")
