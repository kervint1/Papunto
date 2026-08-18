"""電話番号の登録。

方針は2つ。

1. **ログイン時には求めない** — 先に求めると詐欺と思われて離脱するため、
   タスクの実行と換金の手前で初めて求める（`PHONE_REQUIRED`）
2. **登録済みの番号は一意** — Googleアカウントは無料で無限に作れるので、
   ここが無いと同じ人が複数アカウントで報酬を受け取れる。招待機能の前提
"""
from sqlmodel import Session, select

from models import User
from services.auth_service import AuthService


def auth(u: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(u.id)}"}


def other_user(session: Session, suffix: str = "2") -> User:
    u = User(provider_user_id=f"g-{suffix}", email=f"u{suffix}@example.com", name="Otro")
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


# ---------------------------------------------------------------- 登録

def test_starts_unregistered(client, user):
    res = client.get("/api/v1/phone", headers=auth(user))
    assert res.status_code == 200
    assert res.json() == {"registered": False, "phone": None}


def test_register(client, user):
    res = client.post("/api/v1/phone", json={"phone": "987654321"}, headers=auth(user))
    assert res.status_code == 200
    assert res.json() == {"registered": True, "phone": "987654321"}


def test_me_reports_registration(client, user):
    """フロントは phone_registered を見て登録画面へ誘導する"""
    assert client.get("/api/v1/me", headers=auth(user)).json()["phone_registered"] is False
    client.post("/api/v1/phone", json={"phone": "987654321"}, headers=auth(user))
    assert client.get("/api/v1/me", headers=auth(user)).json()["phone_registered"] is True


def test_rejects_invalid_format(client, user):
    for bad in ("123456789", "98765432", "9876543210", "abcdefghi", ""):
        res = client.post("/api/v1/phone", json={"phone": bad}, headers=auth(user))
        assert res.status_code == 422, bad
        assert res.json()["error"]["code"] == "INVALID_PHONE"


def test_trims_whitespace(client, user):
    res = client.post("/api/v1/phone", json={"phone": " 987654321 "}, headers=auth(user))
    assert res.status_code == 200
    assert res.json()["phone"] == "987654321"


def test_requires_auth(client):
    assert client.post("/api/v1/phone", json={"phone": "987654321"}).status_code in (401, 403)


# ---------------------------------------------------------------- 一意性（不正対策の要）

def test_same_number_cannot_be_reused_by_another_account(client, session, user):
    """Googleアカウントは無限に作れるので、ここが最後の砦になる"""
    client.post("/api/v1/phone", json={"phone": "987654321"}, headers=auth(user))

    second = other_user(session)
    res = client.post("/api/v1/phone", json={"phone": "987654321"}, headers=auth(second))
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "PHONE_TAKEN"


def test_multiple_users_can_stay_unregistered(client, session, user):
    """NULLは重複扱いしない。未登録は何人でもいてよい"""
    second = other_user(session)
    for u in (user, second):
        assert client.get("/api/v1/phone", headers=auth(u)).json()["registered"] is False


# ---------------------------------------------------------------- 変更の禁止

def test_cannot_change_once_set(client, user):
    """変更を許すと1つの番号を使い回せる（受取→外す→別アカウントで再登録）"""
    client.post("/api/v1/phone", json={"phone": "987654321"}, headers=auth(user))
    res = client.post("/api/v1/phone", json={"phone": "912345678"}, headers=auth(user))
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "PHONE_ALREADY_SET"


def test_registering_same_number_again_is_idempotent(client, user):
    """再送信で409にはしない。二重送信で混乱させないため"""
    client.post("/api/v1/phone", json={"phone": "987654321"}, headers=auth(user))
    res = client.post("/api/v1/phone", json={"phone": "987654321"}, headers=auth(user))
    assert res.status_code == 200
    assert res.json()["phone"] == "987654321"


# ---------------------------------------------------------------- 換金との連携

def test_withdrawal_blocked_without_phone(client, session, user):
    user.points = 1000
    session.add(user)
    session.commit()

    res = client.post("/api/v1/withdrawals", json={"points": 500}, headers=auth(user))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "PHONE_REQUIRED"


def test_withdrawal_uses_registered_number(client, session, user):
    """申請ごとの自由入力をやめたので、送金先は登録済みの番号になる"""
    user.points = 1000
    session.add(user)
    session.commit()
    client.post("/api/v1/phone", json={"phone": "987654321"}, headers=auth(user))

    res = client.post("/api/v1/withdrawals", json={"points": 500}, headers=auth(user))
    assert res.status_code == 201, res.text
    assert res.json()["yape_phone"] == "987654321"


def test_withdrawal_ignores_client_supplied_phone(client, session, user):
    """他人の番号へ送金させられないこと"""
    user.points = 1000
    session.add(user)
    session.commit()
    client.post("/api/v1/phone", json={"phone": "987654321"}, headers=auth(user))

    res = client.post(
        "/api/v1/withdrawals",
        json={"points": 500, "yape_phone": "911111111"},
        headers=auth(user),
    )
    assert res.status_code == 201, res.text
    assert res.json()["yape_phone"] == "987654321"


def test_phone_persisted(client, session, user):
    client.post("/api/v1/phone", json={"phone": "987654321"}, headers=auth(user))
    stored = session.exec(select(User).where(User.id == user.id)).one()
    assert stored.phone == "987654321"
