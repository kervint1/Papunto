"""枠の期限リマインド。

枠は7日で失効する。画面には期限を出しているが、**ログインしない人には
届かない**。登録して放置している人こそ知らせる相手。
"""
import datetime as dt

import pytest
from sqlmodel import Session

import config
from models import User
from services import reminder_service


@pytest.fixture(autouse=True)
def smtp(monkeypatch):
    """SMTPを設定済みにして、送信は横取りする"""
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(config, "SMTP_USER", "u")
    monkeypatch.setattr(config, "SMTP_PASSWORD", "p")
    monkeypatch.setattr(config, "CRON_SECRET", "s3cret")
    enviados: list[dict] = []
    monkeypatch.setattr(
        "services.mail_service.send",
        lambda **kw: enviados.append(kw),
    )
    return enviados


def age(session: Session, user: User, days: float):
    user.campaign_reserved_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    session.add(user)
    session.commit()
    session.refresh(user)


def cron(client, secret: str = "s3cret"):
    return client.post(
        "/cron/reservation-reminders", headers={"X-Cron-Secret": secret}
    )


# ------------------------------------------------------------ 送る相手

def test_期限が近い人に送る(client, session: Session, user: User, smtp):
    age(session, user, 5.5)  # 残り1.5日

    assert cron(client).json()["sent"] == 1
    assert smtp[0]["to"] == user.email


def test_まだ余裕がある人には送らない(client, session: Session, user: User, smtp):
    age(session, user, 3)  # 残り4日

    assert cron(client).json()["sent"] == 0


def test_受け取り済みの人には送らない(client, session: Session, user: User, smtp):
    """枠が確定しているので失効しない"""
    age(session, user, 6)
    user.campaign_reward_granted_at = dt.datetime.now(dt.timezone.utc)
    session.add(user)
    session.commit()

    assert cron(client).json()["sent"] == 0


def test_二重に送らない(client, session: Session, user: User, smtp):
    age(session, user, 6)

    assert cron(client).json()["sent"] == 1
    assert cron(client).json()["sent"] == 0


def test_送信に失敗したら記録しない(client, session: Session, user: User, smtp, monkeypatch):
    """記録すると二度と送れなくなる。次回の実行で再試行させる"""
    from services import mail_service

    def boom(**kw):
        raise mail_service.MailError("falló")

    monkeypatch.setattr("services.mail_service.send", boom)
    age(session, user, 6)

    assert cron(client).json()["failed"] == 1
    session.refresh(user)
    assert user.reservation_reminder_sent_at is None


def test_凍結や退会には送らない(client, session: Session, user: User, smtp):
    age(session, user, 6)
    user.suspended_at = dt.datetime.now(dt.timezone.utc)
    session.add(user)
    session.commit()

    assert cron(client).json()["sent"] == 0


def test_本文に期限と登録先を入れる(client, session: Session, user: User, smtp):
    age(session, user, 6)
    cron(client)

    body = smtp[0]["body"]
    assert "puntos" in body
    assert config.FRONTEND_ORIGIN in body


# ------------------------------------------------------------ 認証

def test_シークレットが違えば拒否する(client, session: Session, user: User, smtp):
    age(session, user, 6)

    res = cron(client, secret="malo")

    assert res.status_code == 403
    assert smtp == []


def test_シークレット未設定なら拒否する(client, session: Session, user: User, smtp, monkeypatch):
    """未設定を認証スキップにすると誰でも叩けるようになる"""
    monkeypatch.setattr(config, "CRON_SECRET", "")

    assert cron(client).status_code == 503


def test_ヘッダが無ければ拒否する(client, session: Session, user: User, smtp):
    assert client.post("/cron/reservation-reminders").status_code == 403
