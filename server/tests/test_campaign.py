"""事前登録キャンペーン。

設計の要点は2つ。

1. **先着順は登録順（users.id）で決まる** — Googleログインだけで番号が確定し、
   電話番号やタスクを求めない。摩擦を最小にして登録数を最大化するため
2. **交換の開放は日付で制御する** — ポイントの付与は即時だが、交換は
   告知した日（10/1）まで待つ。未払いの残高が10月に戻る動機になる
"""
import datetime as dt

import pytest
from sqlmodel import Session

from models import User
from services import campaign_service
from services.auth_service import AuthService
from tests.conftest import set_campaign


def auth(u: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(u.id)}"}


def make_users(session: Session, n: int) -> list[User]:
    created = []
    for i in range(n):
        u = User(provider_user_id=f"g-c{i}", email=f"c{i}@example.com", name=f"U{i}")
        session.add(u)
        created.append(u)
    session.commit()
    for u in created:
        session.refresh(u)
    return created


# ---------------------------------------------------------------- 登録順の番号

def test_slot_does_not_expose_the_position(client, session, user):
    """個別の番号は返さない。

    ユーザーに見せないうえ、users.id の並び順が推測できてしまう。
    枠の中かどうか（within_limit）だけを返す
    """
    body = client.get("/api/v1/campaign/me", headers=auth(user)).json()
    assert "position" not in body
    assert body["within_limit"] is True


def test_within_limit(client, session, user):
    set_campaign(session, slot_limit=2)
    later = make_users(session, 2)

    assert client.get("/api/v1/campaign/me", headers=auth(user)).json()["within_limit"] is True
    assert client.get("/api/v1/campaign/me", headers=auth(later[0])).json()["within_limit"] is True
    # 3人目は枠外
    assert client.get("/api/v1/campaign/me", headers=auth(later[1])).json()["within_limit"] is False


def test_my_slot_requires_auth(client):
    assert client.get("/api/v1/campaign/me").status_code in (401, 403)


# ---------------------------------------------------------------- 残り枠（LP用）

def test_status_is_public(client, session):
    """LPに「残り63枠」を出すため認証を求めない。希少性が拡散の動機になる"""
    set_campaign(session, slot_limit=100)
    res = client.get("/api/v1/campaign/status")
    assert res.status_code == 200
    assert res.json()["slot_limit"] == 100


def test_remaining_decreases(client, session, user):
    """残り枠は**付与済み件数**で減る。登録者数ではない。

    付与を取り消したときに枠が戻るようにするため。登録者数で数えると、
    不正を見つけて取り消しても表示が戻らず、枠を回収できない
    """
    set_campaign(session, slot_limit=5)
    assert client.get("/api/v1/campaign/status").json()["remaining"] == 5

    campaign_service.grant_reward(session, user)
    session.commit()
    assert client.get("/api/v1/campaign/status").json()["remaining"] == 4

    for u in make_users(session, 3):
        campaign_service.grant_reward(session, u)
    session.commit()
    assert client.get("/api/v1/campaign/status").json()["remaining"] == 1


def test_remaining_never_negative(client, session):
    set_campaign(session, slot_limit=2)
    for u in make_users(session, 5):
        campaign_service.grant_reward(session, u)
    session.commit()
    assert client.get("/api/v1/campaign/status").json()["remaining"] == 0


def test_limit_is_configurable(client, session):
    """100名で始めて後から増やす。設定変更だけで済ませたい"""
    set_campaign(session, slot_limit=200)
    assert client.get("/api/v1/campaign/status").json()["slot_limit"] == 200


# ---------------------------------------------------------------- 交換の開放日

def test_open_when_unset(session):
    set_campaign(session, withdrawals_open_at=None)
    assert campaign_service.withdrawals_open(session) is True


def test_closed_before_date(session):
    set_campaign(session, withdrawals_open_at=dt.date(2026, 10, 1))
    assert campaign_service.withdrawals_open(session, dt.date(2026, 9, 30)) is False


def test_open_on_and_after_date(session):
    set_campaign(session, withdrawals_open_at=dt.date(2026, 10, 1))
    assert campaign_service.withdrawals_open(session, dt.date(2026, 10, 1)) is True
    assert campaign_service.withdrawals_open(session, dt.date(2026, 10, 2)) is True


def test_withdrawal_blocked_before_open_date(client, session, user):
    set_campaign(session, withdrawals_open_at=dt.date(2099, 1, 1))
    user.points = 1000
    user.phone = "987654321"
    session.add(user)
    session.commit()

    res = client.post("/api/v1/withdrawals", json={"points": 500}, headers=auth(user))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "WITHDRAWALS_NOT_OPEN"
    # 開放日を文面に含める（曖昧な表現は詐欺の特徴になる）
    assert "2099-01-01" in res.json()["error"]["message"]


def test_withdrawal_allowed_after_open_date(client, session, user):
    set_campaign(session, withdrawals_open_at=dt.date(2020, 1, 1))
    user.points = 1000
    user.phone = "987654321"
    session.add(user)
    session.commit()

    res = client.post("/api/v1/withdrawals", json={"points": 500}, headers=auth(user))
    assert res.status_code == 201, res.text


def test_status_reports_open_date(client, session):
    set_campaign(session, withdrawals_open_at=dt.date(2026, 10, 1))
    body = client.get("/api/v1/campaign/status").json()
    assert body["withdrawals_open_at"] == "2026-10-01"
    assert body["withdrawals_open"] is False


def test_slot_reports_reward_granted(client, session, user):
    """付与済みかどうかを実績で返す。

    枠内でも、キャンペーン開始前に登録したユーザーは付与されていない。
    画面が「500pt受け取りました」と嘘をつかないために必要
    """
    user.campaign_reward_granted_at = None
    session.add(user)
    session.commit()

    body = client.get("/api/v1/campaign/me", headers=auth(user)).json()
    assert body["within_limit"] is True
    assert body["reward_granted"] is False
    assert body["reward_points"] == 0

    user.campaign_reward_granted_at = dt.datetime.now(dt.timezone.utc)
    session.add(user)
    session.commit()

    body = client.get("/api/v1/campaign/me", headers=auth(user)).json()
    assert body["reward_granted"] is True
    assert body["reward_points"] == 300  # 登録時に入るのは初回分だけ
    assert body["bonus_granted"] is False
    assert body["bonus_points"] == 0
