"""画像の保管先。Appwriteとローカルディスクを切り替える。

- Appwriteの設定があればAppwrite Storage
- 無ければローカルディスク（開発用）

⚠️ ローカル保存は開発専用。Herokuのファイルシステムは揮発性で、dynoが
   再起動すると消える。本番では必ずAppwriteを設定すること
"""
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

import config

logger = logging.getLogger("storage")

APPWRITE = "appwrite"
LOCAL = "local"

# 本文中のURLからファイルIDを拾う。Appwrite形式とローカル形式の両方に対応する
_URL_PATTERN = re.compile(
    r'https?://[^\s"\'\)<>]+?/(?:files/(?P<remote>[A-Za-z0-9_-]+)/view'
    r'|uploads/(?P<local>[A-Za-z0-9_-]+)\.[A-Za-z0-9]+)'
)


class StorageError(Exception):
    """保管先の呼び出し失敗。routerがApiErrorに変換する"""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def backend() -> str:
    """Appwriteが設定されていればそちら、無ければローカル"""
    if config.APPWRITE_PROJECT_ID and config.APPWRITE_API_KEY:
        return APPWRITE
    return LOCAL


def validate(content: bytes, content_type: Optional[str]) -> str:
    """拡張子を返す。受け付けられない場合は例外。保管先に触る前に必ず通す"""
    extension = config.UPLOAD_ALLOWED_TYPES.get((content_type or "").lower())
    if extension is None:
        allowed = ", ".join(sorted(set(config.UPLOAD_ALLOWED_TYPES.values())))
        raise StorageError("INVALID_FILE_TYPE", f"Solo se permiten imágenes ({allowed})")
    if not content:
        raise StorageError("EMPTY_FILE", "El archivo está vacío")
    if len(content) > config.UPLOAD_MAX_BYTES:
        mb = config.UPLOAD_MAX_BYTES // (1024 * 1024)
        raise StorageError("FILE_TOO_LARGE", f"El archivo supera {mb} MB")
    return extension


def extract_file_ids(*texts: str | None) -> set[str]:
    """本文やカバー画像のURLから、自分が保管しているファイルのIDを取り出す"""
    found: set[str] = set()
    for text in texts:
        if not text:
            continue
        for match in _URL_PATTERN.finditer(text):
            found.add(match.group("remote") or match.group("local"))
    return found


def file_id_from_url(url: str) -> Optional[str]:
    match = _URL_PATTERN.search(url or "")
    if match is None:
        return None
    return match.group("remote") or match.group("local")


# ---------------------------------------------------------------- ローカル

def _local_dir() -> str:
    os.makedirs(config.LOCAL_UPLOAD_DIR, exist_ok=True)
    return config.LOCAL_UPLOAD_DIR


def _local_path(file_id: str) -> Optional[str]:
    """file_idから実ファイルを探す（拡張子は保存時に決まるため走査する）"""
    directory = _local_dir()
    for name in os.listdir(directory):
        if name.rsplit(".", 1)[0] == file_id:
            return os.path.join(directory, name)
    return None


def _local_upload(content: bytes, extension: str) -> dict:
    file_id = uuid.uuid4().hex
    name = f"{file_id}.{extension}"
    with open(os.path.join(_local_dir(), name), "wb") as f:
        f.write(content)
    return {"file_id": file_id, "url": f"{config.PUBLIC_BASE_URL}/uploads/{name}"}


def _local_list() -> list[dict]:
    files = []
    directory = _local_dir()
    for name in os.listdir(directory):
        stat = os.stat(os.path.join(directory, name))
        files.append(
            {
                "$id": name.rsplit(".", 1)[0],
                "$createdAt": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            }
        )
    return files


def _local_delete(file_id: str) -> bool:
    path = _local_path(file_id)
    if path is None:
        return False
    try:
        os.remove(path)
        return True
    except OSError as exc:
        logger.warning("local delete failed: %s", exc)
        return False


# ---------------------------------------------------------------- 共通API

def upload(content: bytes, content_type: Optional[str]) -> dict:
    extension = validate(content, content_type)
    if backend() == APPWRITE:
        from services.appwrite_storage import AppwriteStorageService

        return AppwriteStorageService.upload(content, extension)
    return _local_upload(content, extension)


def delete(file_id: str) -> bool:
    if backend() == APPWRITE:
        from services.appwrite_storage import AppwriteStorageService

        return AppwriteStorageService.delete(file_id)
    return _local_delete(file_id)


def list_files() -> list[dict]:
    if backend() == APPWRITE:
        from services.appwrite_storage import AppwriteStorageService

        return AppwriteStorageService.list_files()
    return _local_list()
