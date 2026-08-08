"""記事APIの検証。

公開/非公開の切替と、公開APIが下書きを漏らさないことを中心に見る。
"""
import pytest
from sqlmodel import Session, select

from models import AdminLog, Post, User
from services.auth_service import AuthService


@pytest.fixture(name="admin")
def admin_fixture(session: Session):
    user = User(google_id="g-admin", email="admin@example.com", name="Admin", is_admin=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def auth(u: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(u.id, u.google_id)}"}


def create(client, admin, **overrides):
    body = {"title": "Cómo ahorrar en Perú", "description": "Guía", "body": "# Hola\n\nTexto."}
    body.update(overrides)
    res = client.post("/api/v1/admin/posts", json=body, headers=auth(admin))
    assert res.status_code == 201, res.text
    return res.json()


# ---------------------------------------------------------------- 認可

def test_admin_endpoints_require_admin(client, user):
    assert client.get("/api/v1/admin/posts", headers=auth(user)).status_code == 403
    assert client.post("/api/v1/admin/posts", json={"title": "x"}, headers=auth(user)).status_code == 403


def test_public_endpoints_need_no_auth(client):
    assert client.get("/api/v1/posts").status_code == 200


# ---------------------------------------------------------------- 作成

def test_created_as_draft(client, admin):
    """AIから投稿された場合も含め、常に下書きで作られること"""
    post = create(client, admin)
    assert post["status"] == "draft"
    assert post["published_at"] is None


def test_slug_generated_from_title_without_accents(client, admin):
    """アクセント付き文字がURLに残らないこと"""
    post = create(client, admin, title="Cómo ganar dinero en Perú ñandú")
    assert post["slug"] == "como-ganar-dinero-en-peru-nandu"


def test_duplicate_slug_gets_suffix(client, admin):
    a = create(client, admin, title="Ahorro")
    b = create(client, admin, title="Ahorro")
    assert a["slug"] == "ahorro"
    assert b["slug"] == "ahorro-2"


def test_empty_title_rejected(client, admin):
    res = client.post("/api/v1/admin/posts", json={"title": "   "}, headers=auth(admin))
    assert res.status_code == 422


# ---------------------------------------------------------------- 公開APIの遮蔽

def test_draft_is_hidden_from_public_list(client, admin):
    create(client, admin)
    assert client.get("/api/v1/posts").json()["posts"] == []


def test_draft_returns_404_on_public_detail(client, admin):
    """下書きの存在を漏らさないこと"""
    post = create(client, admin)
    assert client.get(f"/api/v1/posts/{post['slug']}").status_code == 404


def test_published_appears_in_public_api(client, admin):
    post = create(client, admin)
    client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=auth(admin))

    listed = client.get("/api/v1/posts").json()["posts"]
    assert len(listed) == 1
    assert listed[0]["slug"] == post["slug"]
    assert "body" not in listed[0]  # 一覧では本文を運ばない

    detail = client.get(f"/api/v1/posts/{post['slug']}").json()
    assert detail["body"].startswith("# Hola")


# ---------------------------------------------------------------- 公開・非公開

def test_publish_sets_date_and_logs(client, session, admin):
    post = create(client, admin)
    res = client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=auth(admin))
    assert res.status_code == 200
    assert res.json()["status"] == "published"
    assert res.json()["published_at"] is not None

    session.expire_all()
    log = session.exec(select(AdminLog)).one()
    assert log.action == "post.publish"
    assert log.detail["slug"] == post["slug"]


def test_republish_keeps_original_published_at(client, admin):
    """再公開で日付が更新されると、検索エンジンに新しい記事と誤認される"""
    post = create(client, admin)
    first = client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=auth(admin)).json()
    client.post(f"/api/v1/admin/posts/{post['id']}/unpublish", headers=auth(admin))
    again = client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=auth(admin)).json()

    assert again["published_at"] == first["published_at"]


def test_unpublish_hides_from_public(client, admin):
    post = create(client, admin)
    client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=auth(admin))
    client.post(f"/api/v1/admin/posts/{post['id']}/unpublish", headers=auth(admin))

    assert client.get("/api/v1/posts").json()["posts"] == []
    assert client.get(f"/api/v1/posts/{post['slug']}").status_code == 404


def test_publish_rejects_empty_body(client, admin):
    post = create(client, admin, body="")
    res = client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=auth(admin))
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "INCOMPLETE_POST"


# ---------------------------------------------------------------- 更新・削除

def test_slug_locked_after_publish(client, admin):
    """公開後にURLを変えると検索評価を失うため塞ぐ"""
    post = create(client, admin)
    client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=auth(admin))

    res = client.patch(
        f"/api/v1/admin/posts/{post['id']}", json={"slug": "otro"}, headers=auth(admin)
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "SLUG_LOCKED"


def test_partial_update_keeps_other_fields(client, admin):
    post = create(client, admin)
    res = client.patch(
        f"/api/v1/admin/posts/{post['id']}", json={"title": "Nuevo"}, headers=auth(admin)
    )
    assert res.status_code == 200
    assert res.json()["title"] == "Nuevo"
    assert res.json()["body"] == post["body"]  # 触っていない項目は残る


def test_cannot_delete_published(client, admin):
    post = create(client, admin)
    client.post(f"/api/v1/admin/posts/{post['id']}/publish", headers=auth(admin))
    res = client.delete(f"/api/v1/admin/posts/{post['id']}", headers=auth(admin))
    assert res.status_code == 409


def test_delete_draft(client, session, admin):
    post = create(client, admin)
    assert client.delete(f"/api/v1/admin/posts/{post['id']}", headers=auth(admin)).status_code == 204
    session.expire_all()
    assert session.exec(select(Post)).first() is None


# ---------------------------------------------------------------- 一覧

def test_list_filters_by_status(client, admin):
    a = create(client, admin, title="Uno")
    create(client, admin, title="Dos")
    client.post(f"/api/v1/admin/posts/{a['id']}/publish", headers=auth(admin))

    drafts = client.get("/api/v1/admin/posts?status=draft", headers=auth(admin)).json()
    published = client.get("/api/v1/admin/posts?status=published", headers=auth(admin)).json()
    assert drafts["page"]["total"] == 1
    assert published["page"]["total"] == 1


def test_list_search_by_title(client, admin):
    create(client, admin, title="Ahorro en supermercados")
    create(client, admin, title="Viajes baratos")
    res = client.get("/api/v1/admin/posts?q=supermercados", headers=auth(admin)).json()
    assert res["page"]["total"] == 1
