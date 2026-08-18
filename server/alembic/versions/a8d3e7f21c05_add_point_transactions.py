"""ポイント台帳（point_transactions）を追加

`users.points` を動かす処理が残高を直接足し引きしていたため、
キャンペーン報酬と招待報酬が履歴に一切出なかった。

金を扱う以上、残高と履歴が合わない状態を作らない。以後は
**ポイントが動くときは必ず1行書く**。

既存データからの埋め戻しも行う。ただしキャンペーン報酬だけは
付与額を保存していなかったため（`campaign_reward_granted_at` の時刻のみ）、
`campaign_settings.reward_points` の**現在値**で埋める。付与額を変えた後に
このマイグレーションを流すと過去分がずれるので、その場合は手で直す。

⚠️ 未承認の成果（postbacks.status='pending'）は埋め戻さない。
   まだ残高に入っていないため。台帳は実際に動いた分だけを持つ。

Revision ID: a8d3e7f21c05
Revises: f7b2c5d13e94
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a8d3e7f21c05"
down_revision: Union[str, None] = "f7b2c5d13e94"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "point_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("reference_type", sa.String(), nullable=True),
        sa.Column("reference_id", sa.String(), nullable=True),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_point_transactions_user_id", "point_transactions", ["user_id"])
    op.create_index("ix_point_transactions_kind", "point_transactions", ["kind"])
    op.create_index("ix_point_transactions_reference_id", "point_transactions", ["reference_id"])
    op.create_index("ix_point_transactions_created_at", "point_transactions", ["created_at"])

    # --- 埋め戻し ---
    # 承認済みの成果
    op.execute(
        """
        INSERT INTO point_transactions
            (user_id, points, kind, reference_type, reference_id, note, created_at)
        SELECT user_id, reward_points, 'offer', 'postback', id::text,
               campaign_name, COALESCE(approved_at, created_at)
        FROM postbacks
        WHERE status = 'approved' AND reward_points > 0
        """
    )
    # 換金申請（申請時点で残高から引かれている）
    op.execute(
        """
        INSERT INTO point_transactions
            (user_id, points, kind, reference_type, reference_id, note, created_at)
        SELECT user_id, -points, 'withdrawal', 'withdrawal', id::text,
               'Canje por Yape', created_at
        FROM withdrawals
        """
    )
    # 却下された換金は戻っている
    op.execute(
        """
        INSERT INTO point_transactions
            (user_id, points, kind, reference_type, reference_id, note, created_at)
        SELECT user_id, points, 'refund', 'withdrawal', id::text,
               'Devolución por canje rechazado', COALESCE(updated_at, created_at)
        FROM withdrawals
        WHERE status = 'rejected'
        """
    )
    # 携帯チャージ
    op.execute(
        """
        INSERT INTO point_transactions
            (user_id, points, kind, reference_type, reference_id, note, created_at)
        SELECT user_id, -points, 'topup', 'topup', id::text,
               'Recarga ' || COALESCE(operator_name, ''), created_at
        FROM topups
        """
    )
    op.execute(
        """
        INSERT INTO point_transactions
            (user_id, points, kind, reference_type, reference_id, note, created_at)
        SELECT user_id, points, 'refund', 'topup', id::text,
               'Devolución por recarga fallida', COALESCE(updated_at, created_at)
        FROM topups
        WHERE status = 'failed'
        """
    )
    # 招待報酬（付与額は referrals に残っている）
    op.execute(
        """
        INSERT INTO point_transactions
            (user_id, points, kind, reference_type, reference_id, note, created_at)
        SELECT inviter_user_id, reward_points, 'referral', 'referral', id::text,
               'Invitación', settled_at
        FROM referrals
        WHERE settled_at IS NOT NULL AND reward_points > 0
        """
    )
    # キャンペーン報酬（付与額が残っていないので設定の現在値で埋める）
    op.execute(
        """
        INSERT INTO point_transactions
            (user_id, points, kind, note, created_at)
        SELECT u.id,
               (SELECT reward_points FROM campaign_settings WHERE id = 1),
               'campaign',
               'Bono de pre-registro',
               u.campaign_reward_granted_at
        FROM users u
        WHERE u.campaign_reward_granted_at IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_table("point_transactions")
