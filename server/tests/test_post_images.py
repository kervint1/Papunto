"""記事に紐づく画像の後始末の検証。

誤って消すと復旧できないため、「他の記事が使っている画像は消さない」を重点的に見る。
Appwriteへの実通信はモンキーパッチで置き換える。
"""
import pytest
from sqlmodel import Session

import config
from models import Post, User
from services import post_images
from services.appwrite_storage import AppwriteStorageService
from services.auth_service import AuthService


def url(file_id: str) -> str:
    return (
        f"https://cloud.appwrite.io/v1/storage/buckets/papunto-media"
        f"/files/{file_id}/view?project=proj1"
    )


@pytest.fixture(name="admin")
def admin_fixture(session: Session):
    user = User(google_id="g-admin", email="admin@example.com", name="Admin", is_admin=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def auth(u: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(u.id, u.google_id)}"}


@pytest.fixture(name="deleted")
def deleted_fixture(monkeypatch):
    """AppwriteのdeleteをキャプチャしてIDを記録する"""
    seen: list[str] = []
    monkeypatch.setattr(
        AppwriteStorageService, "delete", staticmethod(lambda fid: (seen.append(fid), True)[1])
    )
    return seen


# ---------------------------------------------------------------- URLの抽出

def test_extracts_ids_from_markdown_and_html():
    body = f"texto ![alt]({url('aaa')}) y <img src=\"{url('bbb')}\" />"
    assert post_images.extract_file_ids(body) == {"aaa", "bbb"}


def test_ignores_unrelated_urls():
    body = "![](https://example.com/foto.png) ![](https://images.com/x/files/zzz.png)"
    assert post_images.extract_file_ids(body) == set()


def test_extracts_from_cover_image_too():
    assert post_images.extract_file_ids(None, url("cover")) == {"cover"}


# ---------------------------------------------------------------- 保存時の掃除

def test_removed_image_is_deleted(client, session, admin, deleted):
    post = client.post(
        "/api/v1/admin/posts",
        json={"title": "A", "body": f"![]({url('img1')}) ![]({url('img2')})"},
        headers=auth(admin),
    ).json()

    client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        json={"body": f"![]({url('img1')})"},
        headers=auth(admin),
    )

    assert deleted == ["img2"]


def test_kept_image_is_not_deleted(client, session, admin, deleted):
    post = client.post(
        "/api/v1/admin/posts",
        json={"title": "A", "body": f"![]({url('img1')})"},
        headers=auth(admin),
    ).json()

    client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        json={"body": f"texto nuevo ![]({url('img1')})"},
        headers=auth(admin),
    )

    assert deleted == []


def test_image_used_by_another_post_is_preserved(client, session, admin, deleted):
    """記事間で画像URLをコピペした場合、片方の保存でもう片方が壊れないこと"""
    shared = url("shared")
    a = client.post(
        "/api/v1/admin/posts", json={"title": "A", "body": f"![]({shared})"}, headers=auth(admin)
    ).json()
    client.post(
        "/api/v1/admin/posts", json={"title": "B", "body": f"![]({shared})"}, headers=auth(admin)
    )

    # Aから参照を外す
    client.patch(f"/api/v1/admin/posts/{a['id']}", json={"body": "sin imagen"}, headers=auth(admin))

    assert deleted == []  # Bがまだ使っているので消さない


def test_cover_image_replacement_deletes_old(client, session, admin, deleted):
    post = client.post(
        "/api/v1/admin/posts",
        json={"title": "A", "body": "x", "image_url": url("old")},
        headers=auth(admin),
    ).json()

    client.patch(
        f"/api/v1/admin/posts/{post['id']}",
        json={"image_url": url("new")},
        headers=auth(admin),
    )

    assert deleted == ["old"]


def test_deleting_post_deletes_its_images(client, session, admin, deleted):
    post = client.post(
        "/api/v1/admin/posts",
        json={"title": "A", "body": f"![]({url('only')})"},
        headers=auth(admin),
    ).json()

    client.delete(f"/api/v1/admin/posts/{post['id']}", headers=auth(admin))

    assert deleted == ["only"]


def test_cleanup_failure_does_not_break_save(client, session, admin, monkeypatch):
    """Appwriteが落ちていても記事の保存は成功すること"""
    def boom(*args, **kwargs):
        raise RuntimeError("appwrite down")

    monkeypatch.setattr(post_images, "cleanup_removed", boom)

    post = client.post(
        "/api/v1/admin/posts", json={"title": "A", "body": f"![]({url('x')})"}, headers=auth(admin)
    ).json()
    res = client.patch(
        f"/api/v1/admin/posts/{post['id']}", json={"body": "sin"}, headers=auth(admin)
    )
    assert res.status_code == 200
    assert res.json()["body"] == "sin"


# ---------------------------------------------------------------- 未参照ファイルの掃除

def test_orphan_cleanup_keeps_referenced_and_recent(session, admin, monkeypatch, deleted):
    session.add(Post(slug="a", title="A", body=f"![]({url('used')})"))
    session.commit()

    monkeypatch.setattr(
        AppwriteStorageService,
        "list_files",
        classmethod(lambda cls: [
            {"$id": "used", "$createdAt": "2020-01-01T00:00:00.000+00:00"},
            {"$id": "orphan-old", "$createdAt": "2020-01-01T00:00:00.000+00:00"},
            # 直近のアップロードは編集中の可能性があるので残す
            {"$id": "orphan-fresh", "$createdAt": "2999-01-01T00:00:00.000+00:00"},
        ]),
    )

    result = post_images.cleanup_orphans(session)

    assert deleted == ["orphan-old"]
    assert result == {"deleted": 1, "kept": 2}


def test_cleanup_endpoint_requires_admin(client, user):
    assert client.post("/api/v1/admin/uploads/cleanup", headers=auth(user)).status_code == 403
