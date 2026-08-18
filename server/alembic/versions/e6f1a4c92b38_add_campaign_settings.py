"""campaign_settings テーブルを追加

枠数・報酬・交換の開放日を環境変数からDBへ移す。

キャンペーン中に変わる値（枠は100→200に増やす想定、開放日はリリースが
ずれれば動く）を環境変数に置くと、変更のたびに Heroku の設定変更と
再起動が要る。管理画面から変えられるようにDBへ持たせる。

初期値は 100枠 / 500pt / 開放日 2026-10-01。開放日を **NULL にしない**のは、
NULL が「即座に開放」を意味するため。デプロイ直後に事前登録中のユーザーが
交換できてしまう状態を作らない。

Revision ID: e6f1a4c92b38
Revises: c5d9e3f81a26
"""

import datetime as dt
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e6f1a4c92b38"
down_revision: Union[str, None] = "c5d9e3f81a26"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    table = op.create_table(
        "campaign_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slot_limit", sa.Integer(), nullable=False),
        sa.Column("reward_points", sa.Integer(), nullable=False),
        sa.Column("withdrawals_open_at", sa.Date(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column(
            "updated_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )
    op.bulk_insert(
        table,
        [
            {
                "id": 1,
                "slot_limit": 100,
                "reward_points": 500,
                "withdrawals_open_at": dt.date(2026, 10, 1),
                "updated_at": dt.datetime.now(dt.timezone.utc),
                "updated_by_user_id": None,
            }
        ],
    )


def downgrade() -> None:
    op.drop_table("campaign_settings")
