import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from schemas.admin import Page


class PostBase(BaseModel):
    title: str
    description: str = ""
    body: str = ""
    tags: list[str] = []
    image_url: Optional[str] = None
    author: Optional[str] = None


class PostCreate(PostBase):
    # 省略するとタイトルから自動生成する
    slug: Optional[str] = None


class PostUpdate(BaseModel):
    """部分更新。渡されたフィールドだけ書き換える"""

    slug: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    body: Optional[str] = None
    tags: Optional[list[str]] = None
    image_url: Optional[str] = None
    author: Optional[str] = None


class PostRead(PostBase):
    """管理画面向け。下書きも含む全項目"""

    id: uuid.UUID
    slug: str
    status: str
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PostList(BaseModel):
    posts: list[PostRead]
    page: Page


class PostSummary(BaseModel):
    """公開一覧向け。本文は含めない（一覧で全文を運ばない）"""

    slug: str
    title: str
    description: str
    tags: list[str] = []
    image_url: Optional[str] = None
    author: Optional[str] = None
    published_at: Optional[datetime] = None
    updated_at: datetime


class PublicPostRead(PostSummary):
    body: str


class PublicPostList(BaseModel):
    posts: list[PostSummary]
