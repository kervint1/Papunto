from typing import NoReturn

from fastapi import APIRouter, Depends

from dependencies import get_current_user
from errors import ApiError
from models import User
from schemas.offer import OfferList, OfferRead
from services.cpalead_service import CPALeadError, CPALeadService

router = APIRouter(prefix="/api/v1/offers", tags=["offers"])

_ERROR_STATUS = {
    "CPALEAD_UNAVAILABLE": 502,
}


def _raise_cpalead(exc: CPALeadError) -> NoReturn:
    raise ApiError(_ERROR_STATUS.get(exc.code, 502), exc.code, exc.message)


@router.get("", response_model=OfferList)
def list_offers(user: User = Depends(get_current_user)):
    # subidはクライアントに指定させず、認証済みユーザーのIDをサーバー側で入れる。
    # 任意のsubidを渡せると他人名義の成果を発生させられるため。
    # あわせてCPALeadのAPIキーもサーバー内に留まる
    try:
        offers = CPALeadService.fetch_offers(str(user.id))
    except CPALeadError as exc:
        _raise_cpalead(exc)
    return OfferList(offers=[OfferRead(**o) for o in offers])
