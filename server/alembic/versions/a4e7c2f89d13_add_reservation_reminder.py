"""users.reservation_reminder_sent_at を追加（枠の期限リマインド）

枠は7日で失効するが、画面に出しているだけではログインしない人に届かない。
「知らないうちに枠が消えた」を避けるため、期限が近づいたらメールで知らせる。

Revision ID: a4e7c2f89d13
Revises: f2a8c6d31b95
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a4e7c2f89d13"
down_revision: Union[str, None] = "f2a8c6d31b95"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("reservation_reminder_sent_at", sa.DateTime(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "reservation_reminder_sent_at")
