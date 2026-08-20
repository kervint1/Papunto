"""メールのマジックリンク。

集客はFacebookグループとWhatsApp。**そのアプリ内ブラウザでは
Googleログインが動かない**（403 disallowed_useragent）。マジックリンクは
OAuthを経由しないのでどのブラウザでも通り、外部審査も要らない。

守りたいのは3つ。
1. 生のトークンをDBに残さない（漏れてもログインできない）
2. 1回きり（転送・漏洩しても再利用されない）
3. 他人のメールに大量送信させない
"""
import datetime as dt

import pytest
from sqlmodel import Session, select

import config
from models import MagicLinkToken, User
from services import magic_link_service


@pytest.fixture(autouse=True)
def dev_echo(monkeypatch):
    """SMTPを設定せずに動かす。ログにリンクを出す開発用の経路を使う"""
    monkeypatch.setattr(config, "SMTP_HOST", "")
    monkeypatch.setattr(config, "MAGIC_LINK_DEV_ECHO", True)


def request_link(client, email: str):
    return client.post("/api/v1/auth/magic-link", json={"email": email})


# ---------------------------------------------------------------- 発行

def test_issue_does_not_store_raw_token(client, session):
    """DBが漏れてもログインできないこと。パスワードと同じ扱い"""
    raw = magic_link_service.issue(session, "a@example.com")

    record = session.exec(select(MagicLinkToken)).one()
    assert record.token_hash != raw
    assert raw not in record.token_hash
    assert len(raw) > 20


def test_request_returns_ok_for_any_email(client):
    """存在するメールかを判別させない"""
    assert request_link(client, "cualquiera@example.com").status_code == 200


def test_email_is_normalized(client, session):
    magic_link_service.issue(session, "  MiXeD@Example.COM  ")
    assert session.exec(select(MagicLinkToken)).one().email == "mixed@example.com"


def test_rate_limited(client, session):
    """他人のメールに大量送信させない"""
    for _ in range(magic_link_service.RATE_LIMIT):
        assert request_link(client, "spam@example.com").status_code == 200

    res = request_link(client, "spam@example.com")
    assert res.status_code == 429
    assert res.json()["error"]["code"] == "TOO_MANY_REQUESTS"


# ---------------------------------------------------------------- 検証

def test_verify_creates_user_and_returns_token(client, session):
    raw = magic_link_service.issue(session, "nuevo@example.com")
    res = client.post("/api/v1/auth/magic-link/verify", json={"token": raw})

    assert res.status_code == 200
    assert res.json()["access_token"]

    user = session.exec(select(User).where(User.email == "nuevo@example.com")).one()
    assert user.provider == "email"
    # 登録では付与しない。枠を確保するだけ
    assert user.points == 0
    assert user.campaign_reserved_at is not None


def test_token_is_single_use(client, session):
    """転送・漏洩しても再利用されない"""
    raw = magic_link_service.issue(session, "once@example.com")
    assert client.post("/api/v1/auth/magic-link/verify", json={"token": raw}).status_code == 200

    res = client.post("/api/v1/auth/magic-link/verify", json={"token": raw})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "TOKEN_USED"


def test_expired_token_is_rejected(client, session):
    raw = magic_link_service.issue(session, "old@example.com")
    record = session.exec(select(MagicLinkToken)).one()
    record.expires_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=1)
    session.add(record)
    session.commit()

    res = client.post("/api/v1/auth/magic-link/verify", json={"token": raw})
    assert res.json()["error"]["code"] == "TOKEN_EXPIRED"


def test_unknown_token_is_rejected(client):
    res = client.post("/api/v1/auth/magic-link/verify", json={"token": "no-existe"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "INVALID_TOKEN"


# ---------------------------------------------------------------- 既存との紐づけ

def test_links_to_existing_google_account(client, session):
    """Googleで登録した人が後からメールで入っても同じアカウント。

    分けると枠を二重に消費し、ポイントも分かれる。
    リンクを受け取れた時点でメールの所有が確認できているので安全
    """
    from services import identity_service

    google_user = identity_service.resolve_user(
        session, provider="google", provider_user_id="g-1", email="mismo@example.com"
    )
    session.commit()

    raw = magic_link_service.issue(session, "mismo@example.com")
    client.post("/api/v1/auth/magic-link/verify", json={"token": raw})

    assert len(session.exec(select(User)).all()) == 1
    session.refresh(google_user)
    assert google_user.points == 0


# ---------------------------------------------------------------- 送信できないとき

def test_fails_loudly_when_mail_unavailable(client, monkeypatch):
    """届いていないのに「送った」と言わない。

    ログインの唯一の手段になる場面があるので、黙って成功が一番危ない
    """
    monkeypatch.setattr(config, "MAGIC_LINK_DEV_ECHO", False)
    res = request_link(client, "sinmail@example.com")
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "MAIL_UNAVAILABLE"
