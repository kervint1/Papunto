import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PostbackRead(BaseModel):
    id: uuid.UUID
    provider: str
    reward_points: int
    campaign_name: Optional[str] = None
    status: str  # pending / approved / rejected
    created_at: datetime


class PostbackList(BaseModel):
    postbacks: list[PostbackRead]
