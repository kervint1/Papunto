"""Appwrite Storage バックエンド。

保管先の選択と検証は services/storage.py が行う。ここはAppwrite固有の処理だけを持つ。

FarmMatch の appwrite_storage.py を下敷きにしつつ、ファイル名にAppwriteのfile_idを
含めるようにした（FarmMatchはIDと名前が別UUIDで突き合わせられなかった）。
"""
import logging

import config
from services.storage import StorageError

logger = logging.getLogger("appwrite")


def _as_dict(value) -> dict:
    """SDKの戻り値をdictに揃える。

    appwrite SDK 6以降は dict ではなく Pydantic モデル（File / FileList）を返す。
    バージョンによって形が変わるので、ここで吸収する
    """
    if isinstance(value, dict):
        return value
    for method in ("model_dump", "dict"):
        fn = getattr(value, method, None)
        if callable(fn):
            try:
                return fn(by_alias=True)
            except TypeError:
                return fn()
    return getattr(value, "__dict__", {}) or {}


class AppwriteStorageService:
    _storage = None

    @classmethod
    def _client(cls):
        if cls._storage is not None:
            return cls._storage

        if not config.APPWRITE_PROJECT_ID or not config.APPWRITE_API_KEY:
            raise StorageError(
                "STORAGE_NOT_CONFIGURED", "El almacenamiento de imágenes no está configurado"
            )

        try:
            from appwrite.client import Client
            from appwrite.services.storage import Storage
        except ImportError:
            raise StorageError("STORAGE_NOT_CONFIGURED", "Falta el SDK de Appwrite")

        client = Client()
        client.set_endpoint(config.APPWRITE_ENDPOINT)
        client.set_project(config.APPWRITE_PROJECT_ID)
        client.set_key(config.APPWRITE_API_KEY)
        cls._storage = Storage(client)
        return cls._storage

    @classmethod
    def upload(cls, content: bytes, extension: str, content_type: str | None = None) -> dict:
        storage = cls._client()

        from appwrite.id import ID
        from appwrite.input_file import InputFile

        file_id = ID.unique()
        try:
            result = storage.create_file(
                bucket_id=config.APPWRITE_BUCKET_ID,
                file_id=file_id,
                # ファイル名にfile_idを含める。URLとAppwriteコンソール上の
                # 名前を突き合わせられるようにするため
                file=InputFile.from_bytes(content, f"{file_id}.{extension}", content_type),
            )
        except Exception as exc:
            logger.error("appwrite upload failed: %s", exc)
            raise StorageError("UPLOAD_FAILED", "No se pudo subir la imagen")

        stored_id = _as_dict(result).get("$id", file_id)
        return {"file_id": stored_id, "url": cls.public_url(stored_id)}

    @staticmethod
    def public_url(file_id: str) -> str:
        return (
            f"{config.APPWRITE_ENDPOINT}/storage/buckets/{config.APPWRITE_BUCKET_ID}"
            f"/files/{file_id}/view?project={config.APPWRITE_PROJECT_ID}"
        )

    @classmethod
    def list_files(cls) -> list[dict]:
        storage = cls._client()
        from appwrite.query import Query

        files: list[dict] = []
        offset = 0
        while True:
            try:
                page = storage.list_files(
                    bucket_id=config.APPWRITE_BUCKET_ID,
                    queries=[Query.limit(100), Query.offset(offset)],
                )
            except Exception as exc:
                logger.error("appwrite list failed: %s", exc)
                raise StorageError("LIST_FAILED", "No se pudo listar el almacenamiento")

            batch = [_as_dict(f) for f in _as_dict(page).get("files", [])]
            files.extend(batch)
            if len(batch) < 100:
                return files
            offset += len(batch)

    @classmethod
    def delete(cls, file_id: str) -> bool:
        try:
            cls._client().delete_file(bucket_id=config.APPWRITE_BUCKET_ID, file_id=file_id)
            return True
        except Exception as exc:
            logger.warning("appwrite delete failed: %s", exc)
            return False
