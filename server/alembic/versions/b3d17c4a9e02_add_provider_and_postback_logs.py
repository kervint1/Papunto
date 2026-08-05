"""add provider to postbacks and create postback_logs

Revision ID: b3d17c4a9e02
Revises: 6ce5b32e87fd
Create Date: 2026-08-05 10:00:00.000000

オファーウォールをMonlix単独前提からCPALeadと併存できる形にする。

- postbacks に provider を持たせ、冪等キーを (provider, transaction_id) の複合UNIQUEに変更する。
  取引IDは提供元ごとの採番なので、単独UNIQUEのままだと提供元をまたいで衝突しうる。
- 成果を pending / approved / rejected の3状態で持つ。従来は承認時のみINSERTしていたため、
  既存行は approved（approved_at = created_at）としてバックフィルする。
- ポストバックの生ペイロードを検証結果つきで残す postback_logs を追加する。付与に至らなかった
  リクエスト（署名不正・ユーザー不明・報酬0）の痕跡が現状どこにも残らないため。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


revision: str = 'b3d17c4a9e02'
down_revision: Union[str, None] = '6ce5b32e87fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- postbacks: 列の追加 ---
    # server_default は既存行を埋めるためだけに付け、埋め終わったら外す（アプリ側の既定値に任せる）
    op.add_column('postbacks', sa.Column('provider', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='monlix'))
    op.add_column('postbacks', sa.Column('payout_usd', sa.Numeric(precision=10, scale=4), nullable=True))
    op.add_column('postbacks', sa.Column('campaign_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('postbacks', sa.Column('campaign_name', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.add_column('postbacks', sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='pending'))
    op.add_column('postbacks', sa.Column('approved_at', sa.DateTime(), nullable=True))
    op.add_column('postbacks', sa.Column('rejected_at', sa.DateTime(), nullable=True))
    op.add_column('postbacks', sa.Column('updated_at', sa.DateTime(), nullable=True))

    # --- 既存行のバックフィル ---
    # 従来は status=1（承認）のポストバックだけをINSERTしていたので、既存行はすべて承認済み
    op.execute("UPDATE postbacks SET status = 'approved', approved_at = created_at, updated_at = created_at")

    op.alter_column('postbacks', 'updated_at', nullable=False)
    op.alter_column('postbacks', 'provider', server_default=None)
    op.alter_column('postbacks', 'status', server_default=None)

    # --- インデックス・制約の張り替え ---
    # transaction_id 単独のUNIQUEを外し、複合UNIQUEに置き換える
    op.drop_index(op.f('ix_postbacks_transaction_id'), table_name='postbacks')
    op.create_index(op.f('ix_postbacks_transaction_id'), 'postbacks', ['transaction_id'], unique=False)
    op.create_unique_constraint('uq_postbacks_provider_transaction_id', 'postbacks', ['provider', 'transaction_id'])
    op.create_index(op.f('ix_postbacks_provider'), 'postbacks', ['provider'], unique=False)
    op.create_index(op.f('ix_postbacks_status'), 'postbacks', ['status'], unique=False)
    op.create_index(op.f('ix_postbacks_user_id'), 'postbacks', ['user_id'], unique=False)

    # --- postback_logs ---
    op.create_table('postback_logs',
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('provider', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('transaction_id', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('http_method', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('params', sa.JSON(), nullable=False),
    sa.Column('signature', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('verified', sa.Boolean(), nullable=False),
    sa.Column('remote_ip', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('received_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_postback_logs_provider'), 'postback_logs', ['provider'], unique=False)
    op.create_index(op.f('ix_postback_logs_transaction_id'), 'postback_logs', ['transaction_id'], unique=False)
    op.create_index(op.f('ix_postback_logs_received_at'), 'postback_logs', ['received_at'], unique=False)
    # 「検証に失敗したものを新しい順に見る」調査用
    op.create_index('ix_postback_logs_verified_received_at', 'postback_logs', ['verified', 'received_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_postback_logs_verified_received_at', table_name='postback_logs')
    op.drop_index(op.f('ix_postback_logs_received_at'), table_name='postback_logs')
    op.drop_index(op.f('ix_postback_logs_transaction_id'), table_name='postback_logs')
    op.drop_index(op.f('ix_postback_logs_provider'), table_name='postback_logs')
    op.drop_table('postback_logs')

    op.drop_index(op.f('ix_postbacks_user_id'), table_name='postbacks')
    op.drop_index(op.f('ix_postbacks_status'), table_name='postbacks')
    op.drop_index(op.f('ix_postbacks_provider'), table_name='postbacks')
    op.drop_constraint('uq_postbacks_provider_transaction_id', 'postbacks', type_='unique')
    op.drop_index(op.f('ix_postbacks_transaction_id'), table_name='postbacks')

    # 単独UNIQUEに戻すため、CPALead分（= 取引IDが衝突しうる行）を先に落とす
    op.execute("DELETE FROM postbacks WHERE provider <> 'monlix'")
    op.create_index(op.f('ix_postbacks_transaction_id'), 'postbacks', ['transaction_id'], unique=True)

    op.drop_column('postbacks', 'updated_at')
    op.drop_column('postbacks', 'rejected_at')
    op.drop_column('postbacks', 'approved_at')
    op.drop_column('postbacks', 'status')
    op.drop_column('postbacks', 'campaign_name')
    op.drop_column('postbacks', 'campaign_id')
    op.drop_column('postbacks', 'payout_usd')
    op.drop_column('postbacks', 'provider')
