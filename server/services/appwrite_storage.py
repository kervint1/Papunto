"""Appwrite Storage への画像アップロード。

FarmMatch の appwrite_storage.py を下敷きにしつつ、以下を変えている。
- ファイル名にAppwriteのfile_idを含める（FarmMatchはIDと名前が別UUIDで突き合わせられなかった）
- サイズとMIMEを呼び出し前に検証する（画像以外を投げられる口を塞ぐ）
"""
import logging
from typing import Optional

import config

logger = logging.getLogger("appwrite")


class AppwriteError(Exception):
    """Appwrite呼び出し失敗時の内部例外。routerがApiErrorに変換する"""

    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class AppwriteStorageService:
    """記事のアイキャッチ画像を保管する。

    設定が入っていない環境では import 時点では落とさず、呼ばれた時に
    分かりやすいエラーを返す（画像を使わない開発環境でも起動できるように）
    """

    _storage = None

    @classmethod
    def _client(cls):
        if cls._storage is not None:
            return cls._storage

        if not config.APPWRITE_PROJECT_ID or not config.APPWRITE_API_KEY:
            raise AppwriteError(
                "STORAGE_NOT_CONFIGURED",
                "El almacenamiento de imágenes no está configurado",
            )

        try:
            from appwrite.client import Client
            from appwrite.services.storage import Storage
        except ImportError:
            raise AppwriteError("STORAGE_NOT_CONFIGURED", "Falta el SDK de Appwrite")

        client = Client()
        client.set_endpoint(config.APPWRITE_ENDPOINT)
        client.set_project(config.APPWRITE_PROJECT_ID)
        client.set_key(config.APPWRITE_API_KEY)
        cls._storage = Storage(client)
        return cls._storage

    @staticmethod
    def validate(content: bytes, content_type: Optional[str]) -> str:
        """拡張子を返す。受け付けられない場合は例外"""
        extension = config.UPLOAD_ALLOWED_TYPES.get((content_type or "").lower())
        if extension is None:
            allowed = ", ".join(sorted(config.UPLOAD_ALLOWED_TYPES.values()))
            raise AppwriteError("INVALID_FILE_TYPE", f"Solo se permiten imágenes ({allowed})")
        if not content:
            raise AppwriteError("EMPTY_FILE", "El archivo está vacío")
        if len(content) > config.UPLOAD_MAX_BYTES:
            mb = config.UPLOAD_MAX_BYTES // (1024 * 1024)
            raise AppwriteError("FILE_TOO_LARGE", f"El archivo supera {mb} MB")
        return extension

    @classmethod
    def upload(cls, content: bytes, content_type: Optional[str]) -> dict:
        """アップロードして公開URLを返す"""
        extension = cls.validate(content, content_type)
        storage = cls._client()

        from appwrite.id import ID
        from appwrite.input_file import InputFile

        file_id = ID.unique()
        try:
            result = storage.create_file(
                bucket_id=config.APPWRITE_BUCKET_ID,
                file_id=file_id,
                # ファイル名にfile_idを含める。管理画面から見えるURLと
                # Appwriteのコンソール上の名前を突き合わせられるようにするため
                file=InputFile.from_bytes(content, f"{file_id}.{extension}", content_type),
            )
        except Exception as exc:
            logger.error("appwrite upload failed: %s", exc)
            raise AppwriteError("UPLOAD_FAILED", "No se pudo subir la imagen")

        stored_id = result.get("$id", file_id)
        return {"file_id": stored_id, "url": cls.public_url(stored_id)}

    @staticmethod
    def public_url(file_id: str) -> str:
        return (
            f"{config.APPWRITE_ENDPOINT}/storage/buckets/{config.APPWRITE_BUCKET_ID}"
            f"/files/{file_id}/view?project={config.APPWRITE_PROJECT_ID}"
        )

    @classmethod
    def delete(cls, file_id: str) -> bool:
        try:
            cls._client().delete_file(bucket_id=config.APPWRITE_BUCKET_ID, file_id=file_id)
            return True
        except Exception as exc:
            logger.warning("appwrite delete failed: %s", exc)
            return False

    @staticmethod
    def file_id_from_url(url: str) -> Optional[str]:
        """公開URLからfile_idを取り出す（差し替え時に古い画像を消すため）"""
        if "/files/" not in url:
            return None
        return url.split("/files/")[1].split("/")[0] or None
