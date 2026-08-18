"""ポイント台帳。

**users.points を動かす処理は必ず台帳に1行書く。**

キャンペーン報酬と招待報酬が残高だけ増やして履歴に出なかったのが発端。
金を扱う以上、残高と履歴が合わない状態を作らない。

検査の軸は「台帳の合計 == users.points」。個別のkindを数えるより、
この一致を見る方が新しい報酬を足したときの漏れに気づける。
"""
import datetime as dt

import pytest
from sqlmodel import Session, select

from models import PointTransaction, User, Withdrawal
from services import campaign_service, points_service, referral_service
from services.auth_service import AuthService
from tests.conftest import set_campaign


def auth(u: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(u.id, u.google_id)}"}


def make_user(session: Session, suffix: str) -> User:
    u = User(google_id=f"g-{suffix}", email=f"{suffix}@example.com", name=suffix)
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


def give_points(session: Session, user: User, n: int):
    """本番と同じく**残高と台帳の両方**を動かす。

    テストで残高だけ直接いじると assert_balanced が成立しなくなる。
    その形をテスト側で許すと、本番でも片方だけ動かす書き方が紛れ込む
    """
    user.points += n
    points_service.record(session, user=user, points=n, kind="adjustment", note="seed")
    session.add(user)
    session.commit()


def assert_balanced(session: Session, user: User):
    """台帳の合計が残高と一致すること。台帳の存在意義そのもの"""
    session.refresh(user)
    assert points_service.ledger_total(session, user) == user.points


# ---------------------------------------------------------------- 記録されること

def test_campaign_reward_is_recorded(session, user):
    """発端の不具合。500ptが履歴に出ないと「理由の分からない残高」になる"""
    campaign_service.grant_reward(session, user)
    session.commit()

    tx = session.exec(select(PointTransaction)).one()
    assert tx.kind == "campaign"
    assert tx.points == 300  # 登録時は初回分だけ
    assert tx.note == "Bono de pre-registro"
    assert_balanced(session, user)


def test_referral_reward_is_recorded(client, session, user):
    set_campaign(session, withdrawals_open_at=dt.date(2099, 1, 1))
    code = referral_service.ensure_code(session, user)
    invitee = make_user(session, "amigo")
    client.post("/api/v1/referral/claim", headers=auth(invitee), json={"code": code})

    tx = session.exec(
        select(PointTransaction).where(PointTransaction.kind == "referral")
    ).one()
    assert tx.points == 200
    assert tx.user_id == user.id  # 招待した側に付く
    assert "amigo" in (tx.note or "")
    assert_balanced(session, user)


def test_withdrawal_is_recorded_as_negative(client, session, user):
    """消費は負で記録する。合計が残高と一致する形にするため"""
    user.phone = "987654321"
    session.add(user)
    session.commit()
    give_points(session, user, 1000)

    res = client.post("/api/v1/withdrawals", headers=auth(user), json={"points": 500})
    assert res.status_code in (200, 201)

    tx = session.exec(
        select(PointTransaction).where(PointTransaction.kind == "withdrawal")
    ).one()
    assert tx.points == -500
    assert tx.reference_type == "withdrawal"
    assert_balanced(session, user)


def test_rejected_withdrawal_records_refund(client, session, user):
    """却下で戻した分も残す。残さないと残高だけ増えて理由が出ない"""
    admin = make_user(session, "admin-pt")
    admin.is_admin = True
    user.phone = "987654321"
    session.add(admin)
    session.add(user)
    session.commit()
    give_points(session, user, 1000)

    client.post("/api/v1/withdrawals", headers=auth(user), json={"points": 500})
    w = session.exec(select(Withdrawal)).one()
    client.post(f"/api/v1/admin/withdrawals/{w.id}/reject", headers=auth(admin), json={})

    kinds = [
        t.kind
        for t in session.exec(
            select(PointTransaction).where(PointTransaction.user_id == user.id)
        ).all()
    ]
    assert kinds.count("withdrawal") == 1
    assert kinds.count("refund") == 1
    session.refresh(user)
    assert user.points == 1000  # 戻って元通り
    assert_balanced(session, user)


# ---------------------------------------------------------------- 履歴API

def test_history_is_newest_first(client, session, user):
    campaign_service.grant_reward(session, user)
    session.commit()
    points_service.record(session, user=user, points=-100, kind="adjustment", note="test")
    user.points -= 100
    session.commit()

    body = client.get("/api/v1/points", headers=auth(user)).json()
    assert [t["kind"] for t in body["transactions"]] == ["adjustment", "campaign"]
    assert body["ledger_total"] == 200


def test_history_requires_auth(client):
    assert client.get("/api/v1/points").status_code in (401, 403)


def test_history_is_per_user(client, session, user):
    """他人の履歴が混ざらない"""
    other = make_user(session, "otro")
    campaign_service.grant_reward(session, other)
    session.commit()

    body = client.get("/api/v1/points", headers=auth(user)).json()
    assert body["transactions"] == []


# ---------------------------------------------------------------- 未確定は書かない

def test_pending_offer_is_not_recorded(session, user):
    """未承認の成果は残高に入っていないので台帳にも書かない。

    書くと台帳の合計が残高とずれ、突き合わせが効かなくなる
    """
    from services import postback_service

    postback_service.process_conversion(
        session,
        provider="cpalead",
        userid=str(user.id),
        transaction_id="pt-pending",
        reward_points=300,
        status="pending",
    )
    assert session.exec(select(PointTransaction)).all() == []
    assert_balanced(session, user)


def test_approved_offer_is_recorded(session, user):
    from services import postback_service

    postback_service.process_conversion(
        session,
        provider="cpalead",
        userid=str(user.id),
        transaction_id="pt-approved",
        reward_points=300,
        status="approved",
        campaign_name="Mundo Aventura",
    )
    tx = session.exec(select(PointTransaction)).one()
    assert tx.kind == "offer"
    assert tx.points == 300
    assert tx.note == "Mundo Aventura"
    assert_balanced(session, user)
