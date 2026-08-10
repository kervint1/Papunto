"""posts.slug_custom を追加

slugは作成時にタイトルから生成されるが、これまではタイトルを後から変えても
追従しなかった。管理画面の「新規作成」は仮タイトルで記事を作るため、
実際には全記事が nuevo-articulo-N のまま公開されうる状態だった。

下書きの間はタイトルに追従させたいが、手で書き換えたslugを上書きしては困る。
「手で決めたかどうか」はslugの文字列からは判別できない（連番サフィックスが
付くため slugify(title) との一致比較では判定を誤る）ので、フラグとして持つ。

既存行はすべて自動生成なので false でよい。

Revision ID: a3b7c1f92e40
Revises: d5e91c73a204
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a3b7c1f92e40"
down_revision: Union[str, None] = "d5e91c73a204"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "posts",
        sa.Column("slug_custom", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # 既定値はアプリ側（モデル）で持つので、DBのdefaultは外す
    op.alter_column("posts", "slug_custom", server_default=None)


def downgrade() -> None:
    op.drop_column("posts", "slug_custom")
