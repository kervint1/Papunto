from typing import Optional

from pydantic import BaseModel


class OfferRead(BaseModel):
    campaign_id: str
    title: str
    description: Optional[str] = None
    points: int  # 換算後の獲得予定ポイント
    link: str  # 署名（digest）付きの遷移先URL
    image_url: Optional[str] = None
    conversion: Optional[str] = None  # 成果条件（例: アプリをインストールして起動）
    device: Optional[str] = None


class OfferList(BaseModel):
    offers: list[OfferRead]
