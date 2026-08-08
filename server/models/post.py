import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

# 記事の公開状態。AIに生成させる場合も下書きとして入れ、人が確認してから公開する
STATUS_DRAFT = "draft"
STATUS_PUBLISHED = "published"
POST_STATUSES = (STATUS_DRAFT, STATUS_PUBLISHED)


class Post(SQLModel, table=True):
    """メディアサイト（pandia）の記事。

    ユーザー系のテーブルとは外部キーで繋がない。将来メディアを切り出すときに
    このテーブルだけを移せるようにするため（著者はユーザーIDではなく表示名で持つ）
    """

    __tablename__ = "posts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    slug: str = Field(unique=True, index=True)  # URLになる。公開後は変えない
    title: str
    description: str = Field(default="")  # 検索結果と一覧に出る説明文
    body: str = Field(default="")  # Markdown
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    image_url: Optional[str] = Field(default=None)  # アイキャッチ（Appwrite Storage）
    author: Optional[str] = Field(default=None)  # 表示名。usersへのFKは張らない
    status: str = Field(default=STATUS_DRAFT, index=True)
    # 公開日。sitemapのlastModifiedと構造化データのdatePublishedに使う。
    # 一度公開したら再公開でも上書きしない（検索エンジンに古い記事と見なされないため）
    published_at: Optional[datetime] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    def to_public(self) -> dict[str, Any]:
        """公開APIで返す形。下書き専用の情報は含めない"""
        return {
            "slug": self.slug,
            "title": self.title,
            "description": self.description,
            "body": self.body,
            "tags": self.tags,
            "image_url": self.image_url,
            "author": self.author,
            "published_at": self.published_at,
            "updated_at": self.updated_at,
        }
