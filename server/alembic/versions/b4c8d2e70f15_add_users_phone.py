"""users.phone を追加（nullable ＋ UNIQUE）

Yapeの送金先。事前登録キャンペーンの参加条件でもある。

nullable にするのは、ログイン時点では登録を求めないため。
先に電話番号を求めると詐欺と思われて離脱するので、タスクの実行と
換金の手前で初めて求める。PostgreSQLはUNIQUE制約でNULLを重複扱いしないので、
「未登録は何人でもいるが、登録済みの番号は一意」が自然に成立する。

⚠️ UNIQUEは不正対策の要。Googleアカウントは無料で無限に作れるため、
   これが無いと同じ人が複数アカウントで報酬を何度も受け取れる。
   1人が全予算を持っていける状態になり、Toroxに見せるログも水増しされる。
   招待機能はこの制約の上でしか成立しない。

既存の withdrawals.yape_phone / topups.phone_number は取引ごとの記録として
残す（過去の送金先を書き換えないため）。今後の申請は users.phone を使う。

Revision ID: b4c8d2e70f15
Revises: a3b7c1f92e40
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b4c8d2e70f15"
down_revision: Union[str, None] = "a3b7c1f92e40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("phone", sa.String(), nullable=True))
    # 一意性の担保と、番号からの逆引き（重複チェック）の両方に使う
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_column("users", "phone")
