"""ログイン手段の汎用化。

集客がFacebookグループなのに、**Facebookのアプリ内ブラウザでは
Googleログインが動かない**（403 disallowed_useragent）。手段を増やせる形にした。

ここで守りたいのは「同じ人が複数アカウントにならないこと」。分かれると、

- キャンペーンの枠を二重に消費する
- ポイントが分かれて「消えた」と見える
"""
import pytest
from sqlmodel import Session, select

from models import User
from services import identity_service


def login(session: Session, provider: str, pid: str, email: str, **kw) -> User:
    user = identity_service.resolve_user(
        session, provider=provider, provider_user_id=pid, email=email, **kw
    )
    session.commit()
    session.refresh(user)
    return user


def test_creates_user_on_first_login(session):
    u = login(session, "google", "g-1", "nuevo@example.com", name="Nuevo")
    assert u.provider == "google"
    assert u.provider_user_id == "g-1"
    assert u.points == 300  # キャンペーン報酬が付く


def test_same_provider_id_returns_same_user(session):
    a = login(session, "google", "g-1", "x@example.com")
    b = login(session, "google", "g-1", "x@example.com")
    assert a.id == b.id
    assert b.points == 300  # 2回目で報酬は増えない


def test_same_email_different_provider_links_to_existing(session):
    """同じメールで別プロバイダから来たら既存に紐づける。

    分けると同じ人が2アカウント持ち、キャンペーンの枠を二重に消費する
    """
    google = login(session, "google", "g-1", "mismo@example.com", name="Ana")
    facebook = login(session, "facebook", "fb-1", "mismo@example.com", name="Ana")

    assert facebook.id == google.id
    assert len(session.exec(select(User)).all()) == 1
    assert facebook.points == 300  # 二重に付与しない


def test_different_email_creates_separate_user(session):
    a = login(session, "google", "g-1", "uno@example.com")
    b = login(session, "google", "g-2", "dos@example.com")
    assert a.id != b.id


def test_same_id_across_providers_is_not_the_same_user(session):
    """provider_user_id 単独では一意でない。

    別プロバイダが同じ文字列をIDに使わない保証がないので、
    (provider, provider_user_id) の組で見る
    """
    a = login(session, "google", "12345", "a@example.com")
    b = login(session, "facebook", "12345", "b@example.com")
    assert a.id != b.id


def test_profile_is_refreshed_on_login(session):
    """改名やアイコン変更に追従する"""
    login(session, "google", "g-1", "p@example.com", name="Antes", avatar_url="a.png")
    after = login(session, "google", "g-1", "p@example.com", name="Después", avatar_url="b.png")
    assert after.name == "Después"
    assert after.avatar_url == "b.png"


def test_token_has_no_provider_claim(session):
    """JWTに載せるのは user_id だけ。

    認可は user.id で行っており、以前入れていた google_id は
    一度も参照されていなかった
    """
    from services.auth_service import AuthService

    u = login(session, "google", "g-1", "t@example.com")
    payload = AuthService.verify_token(AuthService.create_access_token(u.id))
    assert payload["sub"] == str(u.id)
    assert "google_id" not in payload
