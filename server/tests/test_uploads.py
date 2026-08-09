"""画像アップロードの検証。

Appwriteへの実通信はせず、検証ロジックと認可、設定未投入時の挙動を見る。
"""
import pytest
from sqlmodel import Session

import config
from models import User
from services import storage
from services.storage import StorageError
from services.auth_service import AuthService

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 100


@pytest.fixture(name="admin")
def admin_fixture(session: Session):
    user = User(google_id="g-admin", email="admin@example.com", name="Admin", is_admin=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def auth(u: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(u.id, u.google_id)}"}


def upload(client, u: User, content=PNG, content_type="image/png", name="foto.png"):
    return client.post(
        "/api/v1/admin/uploads",
        files={"file": (name, content, content_type)},
        headers=auth(u),
    )


# ---------------------------------------------------------------- 認可

def test_requires_authentication(client):
    assert client.post("/api/v1/admin/uploads", files={"file": ("a.png", PNG, "image/png")}).status_code == 401


def test_non_admin_forbidden(client, user):
    assert upload(client, user).status_code == 403


def test_config_endpoint_requires_admin(client, user, admin):
    assert client.get("/api/v1/admin/uploads/config", headers=auth(user)).status_code == 403
    assert client.get("/api/v1/admin/uploads/config", headers=auth(admin)).status_code == 200


# ---------------------------------------------------------------- 検証ロジック

def test_rejects_non_image():
    """画像以外を投げられる口を塞いでいること"""
    with pytest.raises(StorageError) as e:
        storage.validate(b"<?php echo 1; ?>", "application/x-php")
    assert e.value.code == "INVALID_FILE_TYPE"


def test_rejects_empty_file():
    with pytest.raises(StorageError) as e:
        storage.validate(b"", "image/png")
    assert e.value.code == "EMPTY_FILE"


def test_rejects_oversized(monkeypatch):
    monkeypatch.setattr(config, "UPLOAD_MAX_BYTES", 10)
    with pytest.raises(StorageError) as e:
        storage.validate(b"x" * 11, "image/png")
    assert e.value.code == "FILE_TOO_LARGE"


@pytest.mark.parametrize(
    "content_type,expected",
    [("image/png", "png"), ("image/jpeg", "jpg"), ("image/webp", "webp"), ("IMAGE/PNG", "png")],
)
def test_accepts_images(content_type, expected):
    assert storage.validate(PNG, content_type) == expected


# ---------------------------------------------------------------- 設定未投入

def test_falls_back_to_local_storage(client, admin, monkeypatch, tmp_path):
    """Appwrite未設定でも画像を保存できること（ローカル保存）"""
    # Appwrite未設定ならローカルに保存される（開発用のフォールバック）
    monkeypatch.setattr(config, "APPWRITE_PROJECT_ID", "")
    monkeypatch.setattr(config, "APPWRITE_API_KEY", "")
    monkeypatch.setattr(config, "LOCAL_UPLOAD_DIR", str(tmp_path))

    res = upload(client, admin)
    assert res.status_code == 201
    assert "/uploads/" in res.json()["url"]


def test_invalid_type_returns_422_before_touching_appwrite(client, admin, monkeypatch):
    """検証はAppwriteに触る前に行うこと（未設定でも422になる）"""
    monkeypatch.setattr(config, "APPWRITE_PROJECT_ID", "")
    res = upload(client, admin, content=b"not an image", content_type="text/plain", name="a.txt")
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "INVALID_FILE_TYPE"


def test_config_reports_local_backend_when_appwrite_unset(client, admin, monkeypatch):
    monkeypatch.setattr(config, "APPWRITE_PROJECT_ID", "")
    body = client.get("/api/v1/admin/uploads/config", headers=auth(admin)).json()
    assert body["enabled"] is True
    assert body["backend"] == "local"
    assert "image/png" in body["allowed_types"]


# ---------------------------------------------------------------- URL

def test_public_url_and_roundtrip(monkeypatch):
    from services.appwrite_storage import AppwriteStorageService

    monkeypatch.setattr(config, "APPWRITE_PROJECT_ID", "proj1")
    monkeypatch.setattr(config, "APPWRITE_BUCKET_ID", "media")
    url = AppwriteStorageService.public_url("file123")
    assert "/buckets/media/files/file123/view" in url
    assert storage.file_id_from_url(url) == "file123"


def test_local_url_roundtrip(monkeypatch):
    monkeypatch.setattr(config, "PUBLIC_BASE_URL", "http://localhost:8000")
    url = "http://localhost:8000/uploads/abc123.png"
    assert storage.file_id_from_url(url) == "abc123"


def test_file_id_from_unrelated_url():
    assert storage.file_id_from_url("https://example.com/a.png") is None
