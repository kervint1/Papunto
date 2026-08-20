"""Facebookログイン。

集客がFacebookグループなので、来る人はほぼ全員Facebookにログイン済み。
しかもFacebookのアプリ内ブラウザではGoogleログインが動かないため、
そこから来た人にとってはこれが本命の手段になる。

守りたいのは**なりすましの阻止**。アクセストークンを受け取っただけで
信用すると、別のアプリで取ったトークンを投げるだけで他人になれる。
"""
import pytest
from sqlmodel import select

import config
from models import User
from services import facebook_service

APP_ID = "123456"


@pytest.fixture(autouse=True)
def meta_settings(monkeypatch):
    monkeypatch.setattr(config, "META_APP_ID", APP_ID)
    monkeypatch.setattr(config, "META_APP_SECRET", "secret")


class FakeResponse:
    def __init__(self, payload, ok=True, status_code=200):
        self._payload = payload
        self.ok = ok
        self.status_code = status_code

    def json(self):
        return self._payload


def fake_graph(monkeypatch, *, debug: dict, me: dict):
    """Graph APIの応答を差し替える"""

    def _get(url, params=None, timeout=None):
        if "/debug_token" in url:
            return FakeResponse({"data": debug})
        return FakeResponse(me)

    monkeypatch.setattr(facebook_service.requests, "get", _get)


def login(client, token="fb-token"):
    return client.post("/api/v1/auth/facebook", json={"access_token": token})


# ---------------------------------------------------------------- 正常系

def test_creates_user(client, session, monkeypatch):
    fake_graph(
        monkeypatch,
        debug={"is_valid": True, "app_id": APP_ID},
        me={"id": "fb-1", "name": "Ana", "email": "Ana@Example.com"},
    )
    res = login(client)
    assert res.status_code == 200
    assert res.json()["access_token"]

    user = session.exec(select(User).where(User.provider == "facebook")).one()
    assert user.provider_user_id == "fb-1"
    assert user.email == "ana@example.com"  # 小文字に正規化される
    # 登録では付与しない。枠を確保するだけ
    assert user.points == 0
    assert user.campaign_reserved_at is not None


# ---------------------------------------------------------------- なりすまし阻止

def test_rejects_token_from_another_app(client, session, monkeypatch):
    """**これが一番大事な検査。**

    app_id を見ないと、別のアプリで取ったトークンを投げるだけで
    そのユーザーになりすませる
    """
    fake_graph(
        monkeypatch,
        debug={"is_valid": True, "app_id": "999999"},  # 別のアプリ
        me={"id": "fb-1", "email": "victima@example.com"},
    )
    res = login(client)
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "INVALID_FACEBOOK_TOKEN"
    assert session.exec(select(User)).all() == []


def test_rejects_invalid_token(client, monkeypatch):
    fake_graph(
        monkeypatch,
        debug={"is_valid": False, "app_id": APP_ID},
        me={"id": "fb-1", "email": "a@example.com"},
    )
    assert login(client).status_code == 401


# ---------------------------------------------------------------- メールが無い場合

def test_rejects_when_facebook_returns_no_email(client, session, monkeypatch):
    """Facebookはメールを返さないことがある。

    電話番号だけで登録した人や、メールの権限を拒否した人。papuntoは
    メールを前提にしている（10/1の一斉通知、同一性の判定、管理画面の検索）
    ので、作らずに別の手段へ誘導する
    """
    fake_graph(
        monkeypatch,
        debug={"is_valid": True, "app_id": APP_ID},
        me={"id": "fb-1", "name": "Sin Correo"},
    )
    res = login(client)
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "FACEBOOK_NO_EMAIL"
    assert session.exec(select(User)).all() == []


# ---------------------------------------------------------------- 未設定

def test_unavailable_when_not_configured(client, monkeypatch):
    monkeypatch.setattr(config, "META_APP_SECRET", "")
    res = login(client)
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "FACEBOOK_UNAVAILABLE"


# ---------------------------------------------------------------- 既存との紐づけ

def test_links_to_existing_google_account(client, session, monkeypatch):
    """Googleで登録した人が後からFacebookで入っても同じアカウント。

    分けると枠を二重に消費し、ポイントも分かれる
    """
    from services import identity_service

    google_user = identity_service.resolve_user(
        session, provider="google", provider_user_id="g-1", email="mismo@example.com"
    )
    session.commit()

    fake_graph(
        monkeypatch,
        debug={"is_valid": True, "app_id": APP_ID},
        me={"id": "fb-1", "email": "mismo@example.com"},
    )
    login(client)

    assert len(session.exec(select(User)).all()) == 1
    session.refresh(google_user)
    assert google_user.points == 0
