"""users.deleted_at と users.phone_hash を追加（退会）

**Google Play はアカウントを作れるアプリに削除手段を義務づけている**
（2024年4月15日から完全施行）。プライバシーポリシーでも
「Borrar o eliminar sus Datos Personales」と約束している。

物理削除はしない。ポイントの台帳・成果・換金の記録が user_id で刺さっており、
行ごと消すと会計が壊れて過去の支払いを説明できなくなる。

phone_hash は退会時に電話番号のハッシュだけ残すための列。これが無いと
「退会 → 再登録」で事前登録の300ptを何度でも受け取れる。

Revision ID: d7f1bab34e58
Revises: c8e3a5d19f74
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d7f1bab34e58"
down_revision: Union[str, None] = "c8e3a5d19f74"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("phone_hash", sa.String(), nullable=True))
    op.create_index("ix_users_deleted_at", "users", ["deleted_at"])
    # 再付与の判定で毎回引くので索引を張る。UNIQUEにはしない
    # （同じ番号で複数回の退会がありうる）
    op.create_index("ix_users_phone_hash", "users", ["phone_hash"])


def downgrade() -> None:
    op.drop_index("ix_users_phone_hash", table_name="users")
    op.drop_index("ix_users_deleted_at", table_name="users")
    op.drop_column("users", "phone_hash")
    op.drop_column("users", "deleted_at")
