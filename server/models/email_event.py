import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class EmailEvent(SQLModel, table=True):
    """メール提供元から届く配信結果のイベント。

    **バウンスはSMTPが受理した後に非同期で起きる**ため、mail_service.send() が
    成功しても届いたとは限らない。提供元のWebhookで受けないと、こちら側からは
    「送ったのに届かない」が永久に見えない。

    ハードバウンスすると提供元の抑制リストに載り、**原因を直しても以後は
    送信されない**。マジックリンクはFacebookのアプリ内ブラウザで唯一動く
    ログイン経路（Googleは埋め込みWebViewを禁止している）なので、これを
    放置すると該当ユーザーは**気づかれないままログインできなくなる**。

    注意: 送信量に比例して伸びる。Heroku Postgres Essential-0 は1万行上限のため、
    postback_logs と同じく古い行の削除運用が要る。
    """

    __tablename__ = "email_events"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    provider: str = Field(default="resend", index=True)
    # email.bounced / email.complained / email.delivered など提供元の生の値
    event_type: str = Field(index=True)
    # 宛先。**必ず小文字で正規化して入れる**（照合に使うため）
    email: str = Field(index=True)
    # 提供元が振ったメールのID。問い合わせのときに使う
    email_id: Optional[str] = Field(default=None)
    # hard / soft。soft（一時的な失敗）でブロックしてはいけない
    bounce_type: Optional[str] = Field(default=None)
    reason: Optional[str] = Field(default=None)
    payload: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    # 管理画面で解除したら入る。**入るまでブロックが続く**。
    # 提供元側の抑制リストは別途ダッシュボードで消す必要がある
    cleared_at: Optional[datetime] = Field(default=None, index=True)
    received_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), index=True
    )
