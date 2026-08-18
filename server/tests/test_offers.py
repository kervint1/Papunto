"""案件一覧の可視性。

モックの案件は広告主が存在しない架空のもの。一般ユーザーやASPの審査員に
見せると「架空の在庫を並べている」ことになるため、管理者だけに返す。
ただし本番での通し確認は必要なので、機能自体は残す
"""
import pytest
from sqlmodel import Session

import config
from models import User
from services.auth_service import AuthService


@pytest.fixture(name="admin")
def admin_fixture(session: Session):
    user = User(provider_user_id="g-adm", email="adm@example.com", name="Adm", is_admin=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def auth(u: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(u.id)}"}


def test_mock_offers_hidden_from_normal_users(client, user, monkeypatch):
    monkeypatch.setattr(config, "CPALEAD_MOCK", True)
    res = client.get("/api/v1/offers", headers=auth(user))
    assert res.status_code == 200
    assert res.json()["offers"] == []


def test_mock_offers_visible_to_admin(client, admin, monkeypatch):
    """本番でも通しの確認ができるようにしておく。

    実際のHTTP取得はテスト環境から到達できないので、サービス層を差し替えて
    「管理者には取得処理まで進む」ことだけを見る
    """
    from services.cpalead_service import CPALeadService

    monkeypatch.setattr(config, "CPALEAD_MOCK", True)
    monkeypatch.setattr(
        CPALeadService,
        "fetch_offers",
        classmethod(
            lambda cls, subid: [
                {
                    "campaign_id": "1",
                    "title": "Test",
                    "description": "d",
                    "points": 100,
                    "link": "https://example.com",
                    "image_url": None,
                    "conversion": "install",
                    "device": "all",
                }
            ]
        ),
    )
    res = client.get("/api/v1/offers", headers=auth(admin))
    assert res.status_code == 200
    assert len(res.json()["offers"]) == 1


def test_offers_require_auth(client):
    assert client.get("/api/v1/offers").status_code in (401, 403)
