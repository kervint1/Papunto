"""画像アップロード。記事のアイキャッチに使う。

管理者専用。保管先はAppwrite Storageで、DBにはURLだけを持つ。
"""
from typing import NoReturn

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel
from sqlmodel import Session

import config
from database import get_session
from dependencies import require_admin
from errors import ApiError
from services import post_images, storage
from services.storage import StorageError

router = APIRouter(
    prefix="/api/v1/admin/uploads", tags=["admin-uploads"], dependencies=[Depends(require_admin)]
)

_ERROR_STATUS = {
    "INVALID_FILE_TYPE": 422,
    "EMPTY_FILE": 422,
    "FILE_TOO_LARGE": 413,
    "STORAGE_NOT_CONFIGURED": 503,
    "UPLOAD_FAILED": 502,
    "LIST_FAILED": 502,
}


def _raise(exc: StorageError) -> NoReturn:
    raise ApiError(_ERROR_STATUS.get(exc.code, 502), exc.code, exc.message)


class UploadRead(BaseModel):
    url: str
    file_id: str


@router.post("", response_model=UploadRead, status_code=201)
async def upload_image(file: UploadFile = File(...)):
    # 先に全体を読む。上限が5MB程度なのでメモリに載せて問題ない
    content = await file.read()
    try:
        result = storage.upload(content, file.content_type)
    except StorageError as exc:
        _raise(exc)
    return UploadRead(**result)


class DeleteBody(BaseModel):
    url: str


@router.post("/delete", status_code=204)
def delete_image(body: DeleteBody):
    """差し替え時に古い画像を消す。失敗しても致命的ではないので握りつぶす"""
    file_id = storage.file_id_from_url(body.url)
    if file_id:
        storage.delete(file_id)


class CleanupResult(BaseModel):
    deleted: int
    kept: int


@router.post("/cleanup", response_model=CleanupResult)
def cleanup_unused(session: Session = Depends(get_session)):
    """どの記事からも参照されていない画像を消す。

    「ペーストしたが保存せずに離脱した」画像を拾うための手動実行用。
    アップロードから24時間経ったものだけを対象にするので、編集中のものは消えない
    """
    try:
        result = post_images.cleanup_orphans(session)
    except StorageError as exc:
        _raise(exc)
    return CleanupResult(**result)


class UploadConfig(BaseModel):
    """管理画面がアップロード可否と制限を知るための情報"""

    enabled: bool
    backend: str
    max_bytes: int
    allowed_types: list[str]


@router.get("/config", response_model=UploadConfig)
def upload_config():
    return UploadConfig(
        # ローカル保存があるので常に使える。backendで実際の保管先が分かる
        enabled=True,
        backend=storage.backend(),
        max_bytes=config.UPLOAD_MAX_BYTES,
        allowed_types=sorted(config.UPLOAD_ALLOWED_TYPES.keys()),
    )
