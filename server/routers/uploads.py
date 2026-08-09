"""画像アップロード。記事のアイキャッチに使う。

管理者専用。保管先はAppwrite Storageで、DBにはURLだけを持つ。
"""
from typing import NoReturn

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel

import config
from dependencies import require_admin
from errors import ApiError
from services.appwrite_storage import AppwriteError, AppwriteStorageService

router = APIRouter(
    prefix="/api/v1/admin/uploads", tags=["admin-uploads"], dependencies=[Depends(require_admin)]
)

_ERROR_STATUS = {
    "INVALID_FILE_TYPE": 422,
    "EMPTY_FILE": 422,
    "FILE_TOO_LARGE": 413,
    "STORAGE_NOT_CONFIGURED": 503,
    "UPLOAD_FAILED": 502,
}


def _raise(exc: AppwriteError) -> NoReturn:
    raise ApiError(_ERROR_STATUS.get(exc.code, 502), exc.code, exc.message)


class UploadRead(BaseModel):
    url: str
    file_id: str


@router.post("", response_model=UploadRead, status_code=201)
async def upload_image(file: UploadFile = File(...)):
    # 先に全体を読む。上限が5MB程度なのでメモリに載せて問題ない
    content = await file.read()
    try:
        result = AppwriteStorageService.upload(content, file.content_type)
    except AppwriteError as exc:
        _raise(exc)
    return UploadRead(**result)


class DeleteBody(BaseModel):
    url: str


@router.post("/delete", status_code=204)
def delete_image(body: DeleteBody):
    """差し替え時に古い画像を消す。失敗しても致命的ではないので握りつぶす"""
    file_id = AppwriteStorageService.file_id_from_url(body.url)
    if file_id:
        AppwriteStorageService.delete(file_id)


class UploadConfig(BaseModel):
    """管理画面がアップロード可否と制限を知るための情報"""

    enabled: bool
    max_bytes: int
    allowed_types: list[str]


@router.get("/config", response_model=UploadConfig)
def upload_config():
    return UploadConfig(
        enabled=bool(config.APPWRITE_PROJECT_ID and config.APPWRITE_API_KEY),
        max_bytes=config.UPLOAD_MAX_BYTES,
        allowed_types=sorted(config.UPLOAD_ALLOWED_TYPES.keys()),
    )
