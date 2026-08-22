"""campaign_settings.reservation_days を追加（枠の有効期限）

登録はメールアドレスだけででき、その瞬間に枠を消費する。期限が無いと
**フリーメールで手動登録するだけで100枠を埋められる**。金銭的な損は出ない
（番号が無ければ1ptも出ない）が、キャンペーンの目的である「実ユーザーを
100人集める」が達成できなくなる。

規約（/campana）の除外条件は「únicamente（以下の場合に限り）」という
閉じた列挙で、番号未登録は含まれていない。後から期限を課すのは
INDECOPIが問題にする形なので、告知と同時に入れる。

Revision ID: f2a8c6d31b95
Revises: e1c9f4a72b60
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f2a8c6d31b95"
down_revision: Union[str, None] = "e1c9f4a72b60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "campaign_settings",
        sa.Column("reservation_days", sa.Integer(), nullable=False, server_default="7"),
    )
    op.alter_column("campaign_settings", "reservation_days", server_default=None)


def downgrade() -> None:
    op.drop_column("campaign_settings", "reservation_days")
