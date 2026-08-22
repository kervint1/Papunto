"""表示名。

登録時には聞かない。マジックリンクで来る人（Facebookのアプリ内ブラウザ
からの流入）は入口がただでさえ細く、項目を1つ増やすと落ちる。
Google/Facebookは提供元の名前が最初から入るので、実際に空になるのは
マジックリンクの人だけ。
"""
from sqlmodel import Session

from models import User
from services import welcome_service
from services.auth_service import AuthService


def auth(user: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(user.id)}"}


def test_表示名を設定できる(client, session: Session, user: User):
    res = client.patch("/api/v1/me", json={"name": "María López"}, headers=auth(user))

    assert res.status_code == 200
    assert res.json()["name"] == "María López"


def test_空文字を送ると未設定に戻る(client, session: Session, user: User):
    client.patch("/api/v1/me", json={"name": "María"}, headers=auth(user))

    res = client.patch("/api/v1/me", json={"name": "   "}, headers=auth(user))

    assert res.json()["name"] is None


def test_改行や連続する空白を潰す(client, session: Session, user: User):
    """メール本文にそのまま入るので、崩れる文字を残さない"""
    res = client.patch(
        "/api/v1/me", json={"name": "María\n\nLópez   García"}, headers=auth(user)
    )

    assert res.json()["name"] == "María López García"


def test_長すぎる名前は弾く(client, session: Session, user: User):
    res = client.patch("/api/v1/me", json={"name": "a" * 51}, headers=auth(user))

    assert res.status_code == 422


def test_名前があればメールに宛名が入る(session: Session, user: User):
    user.name = "María"
    session.add(user)
    session.commit()

    body = welcome_service._body(session, user)

    assert body.startswith("Hola María,")


def test_名前が無ければ挨拶ごと省く(session: Session, user: User):
    """「Hola ,」になるより挨拶が無い方がまし"""
    user.name = None
    session.add(user)
    session.commit()

    body = welcome_service._body(session, user)

    assert "Hola" not in body
