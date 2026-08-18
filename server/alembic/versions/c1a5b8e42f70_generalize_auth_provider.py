"""認証をプロバイダ非依存にする

`users.google_id` を `provider` + `provider_user_id` に分ける。

集客がFacebookグループなのに、**Facebookのアプリ内ブラウザでは
Googleログインが動かない**（Googleが2021年から埋め込みWebViewでの
OAuthを拒否している。403 disallowed_useragent。こちらの設定では
回避できない）。入口で全員が止まるので、ログイン手段を増やせる形にする。

既存行は provider='google'、provider_user_id=google_id で埋め戻す。

⚠️ 一意なのは (provider, provider_user_id) の組。provider_user_id 単独に
   UNIQUEを張らないこと。別プロバイダが同じ文字列をIDに使わない保証がない。

Revision ID: c1a5b8e42f70
Revises: b9c4f0a62d17
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c1a5b8e42f70"
down_revision: Union[str, None] = "b9c4f0a62d17"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("provider", sa.String(), nullable=False, server_default="google"),
    )
    op.add_column("users", sa.Column("provider_user_id", sa.String(), nullable=True))
    op.execute("UPDATE users SET provider_user_id = google_id")
    op.alter_column("users", "provider_user_id", nullable=False)

    op.create_index("ix_users_provider", "users", ["provider"])
    op.create_index("ix_users_provider_user_id", "users", ["provider_user_id"])
    op.create_unique_constraint(
        "uq_users_provider_provider_user_id", "users", ["provider", "provider_user_id"]
    )

    op.drop_index("ix_users_google_id", table_name="users")
    op.drop_column("users", "google_id")


def downgrade() -> None:
    op.add_column("users", sa.Column("google_id", sa.String(), nullable=True))
    # Google以外で作られたユーザーは戻せないので、そこは空のままになる
    op.execute("UPDATE users SET google_id = provider_user_id WHERE provider = 'google'")
    op.create_index("ix_users_google_id", "users", ["google_id"], unique=True)

    op.drop_constraint("uq_users_provider_provider_user_id", "users", type_="unique")
    op.drop_index("ix_users_provider_user_id", table_name="users")
    op.drop_index("ix_users_provider", table_name="users")
    op.drop_column("users", "provider_user_id")
    op.drop_column("users", "provider")
