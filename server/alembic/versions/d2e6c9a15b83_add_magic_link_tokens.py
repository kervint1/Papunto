"""magic_link_tokens を追加

メールで送るワンタイムのログインリンク。OAuthを経由しないので
Facebookのアプリ内ブラウザでも通る（Googleログインはそこで動かない）。

⚠️ 生のトークンは保存しない。sha256だけ。DBが漏れてもログインできない。

Revision ID: d2e6c9a15b83
Revises: c1a5b8e42f70
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d2e6c9a15b83"
down_revision: Union[str, None] = "c1a5b8e42f70"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "magic_link_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_magic_link_tokens_email", "magic_link_tokens", ["email"])
    op.create_index(
        "ix_magic_link_tokens_token_hash", "magic_link_tokens", ["token_hash"], unique=True
    )
    op.create_index("ix_magic_link_tokens_expires_at", "magic_link_tokens", ["expires_at"])
    op.create_index("ix_magic_link_tokens_created_at", "magic_link_tokens", ["created_at"])


def downgrade() -> None:
    op.drop_table("magic_link_tokens")
