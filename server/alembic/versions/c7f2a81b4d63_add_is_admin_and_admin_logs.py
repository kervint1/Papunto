"""add is_admin to users and create admin_logs

Revision ID: c7f2a81b4d63
Revises: b3d17c4a9e02
Create Date: 2026-08-05 12:00:00.000000

管理画面を自作する方針に変更したことに伴う追加（従来はDBクライアントで直接運用していた）。

- users.is_admin: 管理画面の利用可否。画面からは昇格させず、DBクライアントで直接UPDATEする
- admin_logs: 管理画面からの操作履歴。換金の承認・却下はお金が動くうえ取り消せないため、
  誰がいつ何をしたかを必ず残す
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'c7f2a81b4d63'
down_revision: Union[str, None] = 'b3d17c4a9e02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column('users', 'is_admin', server_default=None)
    op.create_index(op.f('ix_users_is_admin'), 'users', ['is_admin'], unique=False)

    op.create_table('admin_logs',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('admin_user_id', sa.Integer(), nullable=False),
    sa.Column('action', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('target_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('target_id', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('detail', sa.JSON(), nullable=False),
    sa.Column('note', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['admin_user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_admin_logs_admin_user_id'), 'admin_logs', ['admin_user_id'], unique=False)
    op.create_index(op.f('ix_admin_logs_action'), 'admin_logs', ['action'], unique=False)
    op.create_index(op.f('ix_admin_logs_created_at'), 'admin_logs', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_admin_logs_created_at'), table_name='admin_logs')
    op.drop_index(op.f('ix_admin_logs_action'), table_name='admin_logs')
    op.drop_index(op.f('ix_admin_logs_admin_user_id'), table_name='admin_logs')
    op.drop_table('admin_logs')

    op.drop_index(op.f('ix_users_is_admin'), table_name='users')
    op.drop_column('users', 'is_admin')
