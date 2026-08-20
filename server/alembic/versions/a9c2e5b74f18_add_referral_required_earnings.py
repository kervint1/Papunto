"""campaign_settings.referral_required_earnings を追加

招待の成立条件を「招待された人がタスクで稼いだ額」にする。

登録や電話番号を条件にすると、farming にかかる費用（メール、SIM）だけが
壁になる。タスクの実績を条件にすると、成立ごとに**本物のASPの成果**が要る。
つまり farming をやるほどこちらの売上も増え、攻撃が自滅する。

件数ではなく獲得ポイントで見る。件数だと一番安い案件を並べるだけで
済むため（案件は45ptから900ptまで幅がある）。

Revision ID: a9c2e5b74f18
Revises: f3a7d81c6e29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9c2e5b74f18"
down_revision: Union[str, None] = "f3a7d81c6e29"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "campaign_settings",
        sa.Column(
            "referral_required_earnings", sa.Integer(), nullable=False, server_default="500"
        ),
    )


def downgrade() -> None:
    op.drop_column("campaign_settings", "referral_required_earnings")
