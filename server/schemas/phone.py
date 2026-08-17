from typing import Optional

from pydantic import BaseModel


class PhoneRegister(BaseModel):
    phone: str


class PhoneStatus(BaseModel):
    registered: bool
    phone: Optional[str] = None
