from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    google_id: str = Field(unique=True, index=True)  # GoogleのIDトークンのsubクレーム
    email: str = Field(unique=True)
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    points: int = Field(default=0)  # 所持ポイント（現金額は持たない）
    # 管理画面の利用可否。昇格は画面から行わずDBクライアントで直接UPDATEする
    # （管理画面が乗っ取られても管理者を増やされないようにするため）
    is_admin: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
