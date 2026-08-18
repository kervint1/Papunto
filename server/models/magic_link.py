from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class MagicLinkToken(SQLModel, table=True):
    """メールで送るワンタイムのログインリンク。

    OAuthを経由しないので、**Facebookのアプリ内ブラウザでも通る**。
    Googleは埋め込みWebViewでのOAuthを拒否するため、そこが唯一の抜け道になる。

    ⚠️ 生のトークンは保存しない。ハッシュだけ持つ。DBが漏れても、
       その中身でログインできないようにするため（パスワードと同じ扱い）。
    """

    __tablename__ = "magic_link_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    # sha256(生トークン)。生のトークンはメールの中にしか存在しない
    token_hash: str = Field(unique=True, index=True)
    expires_at: datetime = Field(index=True)
    # 使用済みの時刻。**1回しか使えない**（リンクが転送・漏洩しても再利用されない）
    used_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), index=True
    )
