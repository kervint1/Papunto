"""users.campaign_reserved_at を追加

先着枠の確保と、ポイントの付与を分ける。

登録しただけで300ptを付与していたため、**メールアドレスを大量に作るだけで
盗めるものが生まれていた**（マジックリンクのログインがあるので、電話番号も
Googleアカウントも要らない。メールは無料で無限に作れる）。

付与を「電話番号を登録したとき」に遅らせ、枠の判定だけを登録時に行う。
偽アカウントは電話番号を登録しないので、永久に付与されない。

既存の付与済みユーザーは、その時刻を確保時刻としても埋める。

Revision ID: f3a7d81c6e29
Revises: e4f8b2c76a19
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3a7d81c6e29"
down_revision: Union[str, None] = "e4f8b2c76a19"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("campaign_reserved_at", sa.DateTime(), nullable=True))
    op.create_index("ix_users_campaign_reserved_at", "users", ["campaign_reserved_at"])
    # 付与済みの人は枠も確保済み
    op.execute(
        "UPDATE users SET campaign_reserved_at = campaign_reward_granted_at "
        "WHERE campaign_reward_granted_at IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_index("ix_users_campaign_reserved_at", table_name="users")
    op.drop_column("users", "campaign_reserved_at")
