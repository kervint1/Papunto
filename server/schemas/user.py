from typing import Optional

from pydantic import BaseModel


class MeResponse(BaseModel):
    id: int
    email: str
    name: Optional[str]
    avatar_url: Optional[str]
    points: int
    is_admin: bool = False
    min_withdrawal_points: int
    points_per_sol: int
