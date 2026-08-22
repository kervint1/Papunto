"""email_events を追加

メール提供元（Resend）の配信結果Webhookを記録する。

**バウンスはSMTPが受理した後に非同期で起きる**ため、送信が成功しても届いた
とは限らない。ハードバウンスすると提供元の抑制リストに載り、原因を直しても
以後は送信されない。マジックリンクはFacebookのアプリ内ブラウザで唯一動く
ログイン経路なので、放置すると該当ユーザーが**気づかれないまま締め出される**。

Revision ID: c8e3a5d19f74
Revises: b6d4f9e13a52
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c8e3a5d19f74"
down_revision: Union[str, None] = "b6d4f9e13a52"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("provider", sa.String(), nullable=False, server_default="resend"),
        sa.Column("event_type", sa.String(), nullable=False),
        # 宛先。照合に使うので必ず小文字で入れる
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("email_id", sa.String(), nullable=True),
        sa.Column("bounce_type", sa.String(), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("cleared_at", sa.DateTime(), nullable=True),
        sa.Column("received_at", sa.DateTime(), nullable=False),
    )
    op.alter_column("email_events", "provider", server_default=None)

    op.create_index("ix_email_events_provider", "email_events", ["provider"])
    op.create_index("ix_email_events_event_type", "email_events", ["event_type"])
    op.create_index("ix_email_events_cleared_at", "email_events", ["cleared_at"])
    op.create_index("ix_email_events_received_at", "email_events", ["received_at"])
    # ブロック判定は「このアドレスに未解除のイベントがあるか」を毎回引くので、
    # メール単体ではなく解除状態との複合で張る
    op.create_index("ix_email_events_email_cleared", "email_events", ["email", "cleared_at"])


def downgrade() -> None:
    op.drop_index("ix_email_events_email_cleared", table_name="email_events")
    op.drop_index("ix_email_events_received_at", table_name="email_events")
    op.drop_index("ix_email_events_cleared_at", table_name="email_events")
    op.drop_index("ix_email_events_event_type", table_name="email_events")
    op.drop_index("ix_email_events_provider", table_name="email_events")
    op.drop_table("email_events")
