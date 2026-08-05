import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class PostbackLog(SQLModel, table=True):
    """ポストバックの生ペイロードを検証結果つきで記録する監査ログ。

    Postbackテーブルは「付与対象になった成果」しか持たないため、署名不正・ユーザー不明・
    報酬0といった付与に至らなかったリクエストは痕跡が残らない。「なぜ付与されなかったか」を
    後から追えるよう、検証に失敗したものも verified=False で残す。

    注意: 行数がいちばん伸びるテーブル。Heroku Postgres Essential-0 は1万行上限のため、
    90日より古い行を定期削除するか、Essential-1へ移行する運用が必要。
    """

    __tablename__ = "postback_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    provider: str = Field(index=True)  # monlix / cpalead
    transaction_id: Optional[str] = Field(default=None, index=True)  # 生ペイロード由来のため任意
    http_method: str  # GET / POST
    params: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))  # クエリまたはボディの生JSON
    signature: Optional[str] = Field(default=None)  # 提供元が送ってきた署名（生値）
    verified: bool = Field(default=False, index=True)  # 署名検証の結果
    remote_ip: str
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
