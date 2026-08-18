"""招待（リファラル）。

要点は3つ。

1. **成立の条件は時期で変わる** — 事前登録の期間中は登録した時点で成立させる。
   ここで成立させないと、100人を集めたい期間に招待報酬が1件も出ない
2. **1人が招待されるのは1回だけ** — 付け替えも遡っての適用も許さない
3. **自作自演を止めているのは users.phone のUNIQUE** — ここのロジックではない。
   報酬はポイントで即時に付くが、現金になるのは電話番号を経た換金だけ
"""
import datetime as dt

import pytest
from sqlmodel import Session, select

from models import Referral, User
from services import referral_service
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


@pytest.fixture(name="inviter")
def inviter_fixture(session: Session):
    return make_user(session, "inviter")


# ---------------------------------------------------------------- コードの発行

def test_code_is_issued_on_first_read(client, session, inviter):
    body = client.get("/api/v1/referral", headers=auth(inviter)).json()
    assert len(body["code"]) == referral_service.CODE_LENGTH
    assert body["code"] in body["share_url"]

    # 2回目も同じコード（毎回変わると共有済みのリンクが死ぬ）
    again = client.get("/api/v1/referral", headers=auth(inviter)).json()
    assert again["code"] == body["code"]


def test_code_avoids_confusable_characters(session, inviter):
    """WhatsAppや口頭で伝え間違えないよう 0/O, 1/I/L を使わない"""
    code = referral_service.ensure_code(session, inviter)
    assert not set(code) & set("01OIL")


def test_referral_requires_auth(client):
    assert client.get("/api/v1/referral").status_code in (401, 403)


# ---------------------------------------------------------------- 適用と成立

def test_claim_settles_immediately_during_pre_registration(client, session, inviter):
    """事前登録の期間中は登録した時点で成立させる。

    ここで成立させないと、集客したいまさにその期間に報酬が1件も出ない
    """
    set_campaign(session, withdrawals_open_at=dt.date(2099, 1, 1))
    code = referral_service.ensure_code(session, inviter)
    invitee = make_user(session, "invitee")

    res = client.post("/api/v1/referral/claim", headers=auth(invitee), json={"code": code})
    assert res.status_code == 200

    session.refresh(inviter)
    assert inviter.points == 200

    referral = session.exec(select(Referral)).one()
    assert referral.settled_at is not None
    assert referral.reward_points == 200


def test_claim_waits_for_phone_after_launch(client, session, inviter):
    """交換が開いた後は電話番号の登録まで成立させない。

    登録だけで報酬が出続けると「登録して使わない人」を招待する動機が残る
    """
    set_campaign(session, withdrawals_open_at=dt.date(2020, 1, 1))
    code = referral_service.ensure_code(session, inviter)
    invitee = make_user(session, "invitee2")

    client.post("/api/v1/referral/claim", headers=auth(invitee), json={"code": code})
    session.refresh(inviter)
    assert inviter.points == 0

    referral = session.exec(select(Referral)).one()
    assert referral.settled_at is None

    # 電話番号を登録すると成立する
    res = client.post("/api/v1/phone", headers=auth(invitee), json={"phone": "987654321"})
    assert res.status_code == 200

    session.refresh(inviter)
    assert inviter.points == 200


def test_code_is_case_insensitive(client, session, inviter):
    code = referral_service.ensure_code(session, inviter)
    invitee = make_user(session, "invitee3")
    res = client.post(
        "/api/v1/referral/claim", headers=auth(invitee), json={"code": code.lower()}
    )
    assert res.status_code == 200


# ---------------------------------------------------------------- 不正対策

def test_cannot_use_own_code(client, session, inviter):
    code = referral_service.ensure_code(session, inviter)
    res = client.post("/api/v1/referral/claim", headers=auth(inviter), json={"code": code})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "SELF_REFERRAL"
    session.refresh(inviter)
    assert inviter.points == 0


def test_invitee_can_only_be_claimed_once(client, session, inviter):
    """付け替えも二重取りもできない"""
    other = make_user(session, "other")
    code = referral_service.ensure_code(session, inviter)
    other_code = referral_service.ensure_code(session, other)
    invitee = make_user(session, "invitee4")

    client.post("/api/v1/referral/claim", headers=auth(invitee), json={"code": code})
    res = client.post(
        "/api/v1/referral/claim", headers=auth(invitee), json={"code": other_code}
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "ALREADY_INVITED"

    session.refresh(other)
    assert other.points == 0


def test_unknown_code_is_rejected(client, session):
    invitee = make_user(session, "invitee5")
    res = client.post("/api/v1/referral/claim", headers=auth(invitee), json={"code": "ZZZZZZZZ"})
    assert res.status_code == 404


def test_old_account_cannot_claim(client, session, inviter):
    """遡って紐づけられると、既存ユーザーを招待したことにできてしまう"""
    code = referral_service.ensure_code(session, inviter)
    invitee = make_user(session, "invitee6")
    invitee.created_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=30)
    session.add(invitee)
    session.commit()

    res = client.post("/api/v1/referral/claim", headers=auth(invitee), json={"code": code})
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "CLAIM_WINDOW_CLOSED"


def test_stops_at_max_per_user(client, session, inviter):
    """青天井にすると自作自演の被害額に上限が無くなる"""
    set_campaign(session, withdrawals_open_at=dt.date(2099, 1, 1), referral_max_per_user=2)
    code = referral_service.ensure_code(session, inviter)

    for i in range(3):
        invitee = make_user(session, f"lim{i}")
        client.post("/api/v1/referral/claim", headers=auth(invitee), json={"code": code})

    session.refresh(inviter)
    assert inviter.points == 400  # 2件分だけ

    settled = session.exec(select(Referral).where(Referral.settled_at.is_not(None))).all()
    assert len(settled) == 2


# ---------------------------------------------------------------- 集計

def test_counts_are_reported(client, session, inviter):
    set_campaign(session, withdrawals_open_at=dt.date(2099, 1, 1))
    code = referral_service.ensure_code(session, inviter)
    for i in range(2):
        invitee = make_user(session, f"cnt{i}")
        client.post("/api/v1/referral/claim", headers=auth(invitee), json={"code": code})

    body = client.get("/api/v1/referral", headers=auth(inviter)).json()
    assert body["total"] == 2
    assert body["settled"] == 2
    assert body["earned_points"] == 400
    assert body["reward_points"] == 200
    assert body["settles_on_registration"] is True


# ---------------------------------------------------------------- コードの手入力

def test_can_claim_is_reported_for_new_user(client, session):
    """リンクが壊れた人に手入力の口を出すため、入力可否を返す"""
    invitee = make_user(session, "fresh")
    body = client.get("/api/v1/referral", headers=auth(invitee)).json()
    assert body["can_claim"] is True
    assert body["invited_by"] is None


def test_can_claim_is_false_after_being_invited(client, session, inviter):
    code = referral_service.ensure_code(session, inviter)
    invitee = make_user(session, "already")
    client.post("/api/v1/referral/claim", headers=auth(invitee), json={"code": code})

    body = client.get("/api/v1/referral", headers=auth(invitee)).json()
    assert body["can_claim"] is False
    assert body["invited_by"] == "inviter"


def test_can_claim_is_false_for_old_account(client, session):
    invitee = make_user(session, "stale")
    invitee.created_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=30)
    session.add(invitee)
    session.commit()

    body = client.get("/api/v1/referral", headers=auth(invitee)).json()
    assert body["can_claim"] is False


# ---------------------------------------------------------------- ログイン前の確認

def test_check_is_public(client, session, inviter):
    """登録の前に「ちゃんと友達に入るのか」を確かめられるようにする。

    確かめずに登録させると、不安なまま進ませることになる
    """
    code = referral_service.ensure_code(session, inviter)
    res = client.get(f"/api/v1/referral/check?code={code}")
    assert res.status_code == 200  # 認証ヘッダなし
    assert res.json() == {"valid": True, "inviter_name": "inviter"}


def test_check_returns_only_first_name(client, session):
    """誰でも叩ける経路なので、フルネームまでは見せない"""
    u = make_user(session, "full")
    u.name = "Carla Rodríguez Díaz"
    session.add(u)
    session.commit()
    code = referral_service.ensure_code(session, u)

    assert client.get(f"/api/v1/referral/check?code={code}").json()["inviter_name"] == "Carla"


def test_check_is_case_insensitive(client, session, inviter):
    code = referral_service.ensure_code(session, inviter)
    assert client.get(f"/api/v1/referral/check?code={code.lower()}").json()["valid"] is True


def test_check_unknown_code_is_not_an_error(client):
    """404にせず valid=false を返す。画面で扱いやすくするため"""
    res = client.get("/api/v1/referral/check?code=ZZZZZZZZ")
    assert res.status_code == 200
    assert res.json() == {"valid": False, "inviter_name": None}
