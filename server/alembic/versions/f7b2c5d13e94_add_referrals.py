"""招待（リファラル）機能

users.referral_code と referrals テーブルを追加し、
campaign_settings に招待報酬の設定を足す。

広告の代わりの集客経路。ペルーはWhatsApp中心で、友達からのリンクが
広告より強く効く。

invitee_user_id を UNIQUE にしているのは、**1人が招待されるのは1回だけ**
にするため。後から別の招待元へ付け替えることもできなくなる。

Revision ID: f7b2c5d13e94
Revises: e6f1a4c92b38
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f7b2c5d13e94"
down_revision: Union[str, None] = "e6f1a4c92b38"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("referral_code", sa.String(), nullable=True))
    # 発行済みの人だけ値が入る。NULL同士は衝突しないのでUNIQUEで問題ない
    op.create_index("ix_users_referral_code", "users", ["referral_code"], unique=True)

    op.create_table(
        "referrals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("inviter_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("invitee_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("settled_at", sa.DateTime(), nullable=True),
        sa.Column("reward_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_referrals_inviter_user_id", "referrals", ["inviter_user_id"])
    # 1人が招待されるのは1回だけ
    op.create_index("ix_referrals_invitee_user_id", "referrals", ["invitee_user_id"], unique=True)
    op.create_index("ix_referrals_code", "referrals", ["code"])
    op.create_index("ix_referrals_settled_at", "referrals", ["settled_at"])

    # 招待の設定もキャンペーン設定と同じ場所（管理画面から変える）に置く
    op.add_column(
        "campaign_settings",
        sa.Column("referral_reward_points", sa.Integer(), nullable=False, server_default="200"),
    )
    op.add_column(
        "campaign_settings",
        sa.Column("referral_max_per_user", sa.Integer(), nullable=False, server_default="20"),
    )


def downgrade() -> None:
    op.drop_column("campaign_settings", "referral_max_per_user")
    op.drop_column("campaign_settings", "referral_reward_points")
    op.drop_table("referrals")
    op.drop_index("ix_users_referral_code", table_name="users")
    op.drop_column("users", "referral_code")
