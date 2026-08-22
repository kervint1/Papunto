"""users.suspended_at を追加（アカウントの凍結）

規約9条で「停止または解約できる」と定めているのに、実装が無かった。
いまあるのは campaign_excluded（先着枠から外して報酬を取り消す）だけで、
アカウント自体は使い続けられる状態だった。

削除（deleted_at）とは用途が違う。削除は個人情報を落とすので本人の請求に
応えられるが、別のメールアドレスで戻ってこられるため不正対策としては弱い。
凍結はアカウントを残したまま使わせない。

Revision ID: e1c9f4a72b60
Revises: d7f1bab34e58
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e1c9f4a72b60"
down_revision: Union[str, None] = "d7f1bab34e58"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("suspended_at", sa.DateTime(), nullable=True))
    op.create_index("ix_users_suspended_at", "users", ["suspended_at"])


def downgrade() -> None:
    op.drop_index("ix_users_suspended_at", table_name="users")
    op.drop_column("users", "suspended_at")
