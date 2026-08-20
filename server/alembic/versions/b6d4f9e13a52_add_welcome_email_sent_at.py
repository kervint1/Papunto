"""users.welcome_email_sent_at を追加

登録完了メールの二重送信を防ぐ。

事前登録はアプリを見せずに待機リストとして扱うので、**登録した実感が
メールしかない**。確実に1通送り、2通は送らない。

既存ユーザーは送信済み扱いにする（今から過去分を送る意味がないため）。

Revision ID: b6d4f9e13a52
Revises: a9c2e5b74f18
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b6d4f9e13a52"
down_revision: Union[str, None] = "a9c2e5b74f18"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("welcome_email_sent_at", sa.DateTime(), nullable=True))
    # 既存ユーザーには今さら送らない
    op.execute("UPDATE users SET welcome_email_sent_at = created_at")


def downgrade() -> None:
    op.drop_column("users", "welcome_email_sent_at")
