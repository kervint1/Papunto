"""登録完了メール。

事前登録の期間中はアプリを見せない（中にタスクが1件も無いため）。
**登録した実感が残るのはこのメールだけ**なので、確実に1通送り、2通は送らない。
"""
import pytest
from sqlmodel import select

import config
from models import User
from services import identity_service, mail_service, welcome_service


@pytest.fixture(name="sent")
def sent_fixture(monkeypatch):
    """SMTPを設定済みに見せかけ、送った内容を記録する"""
    box: list[dict] = []
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(config, "SMTP_USER", "a@example.com")
    monkeypatch.setattr(config, "SMTP_PASSWORD", "x")
    monkeypatch.setattr(
        mail_service, "send", lambda **kw: box.append(kw)
    )
    return box


def register(client, session, email="nuevo@example.com"):
    """マジックリンクで登録する（3経路のうち一番短い）"""
    from services import magic_link_service

    raw = magic_link_service.issue(session, email)
    return client.post("/api/v1/auth/magic-link/verify", json={"token": raw})


# ---------------------------------------------------------------- 送る

def test_sends_on_registration(client, session, sent):
    register(client, session)

    assert len(sent) == 1
    assert sent[0]["to"] == "nuevo@example.com"
    assert "pre-registro" in sent[0]["subject"].lower()

    user = session.exec(select(User).where(User.email == "nuevo@example.com")).one()
    assert user.welcome_email_sent_at is not None


def test_body_explains_how_to_get_the_points(client, session, sent):
    """付与は電話番号の登録時。メールがその案内になっていないと誰も受け取らない"""
    register(client, session)
    body = sent[0]["body"]

    assert "Yape" in body
    assert "300" in body  # 初回分
    assert "200" in body  # タスク後
    assert "/campana" in body  # 規約への導線


def test_does_not_send_twice(client, session, sent):
    """2通目を送らない"""
    register(client, session)
    user = session.exec(select(User).where(User.email == "nuevo@example.com")).one()

    assert welcome_service.send_if_needed(session, user) is False
    assert len(sent) == 1


def test_second_login_does_not_send(client, session, sent):
    register(client, session)
    register(client, session)  # 同じメールでもう一度ログイン
    assert len(sent) == 1


# ---------------------------------------------------------------- 送らない

def test_does_not_send_when_smtp_is_not_configured(client, session, monkeypatch):
    """ローカルなど。記録もしないので、SMTPを入れれば次回送られる"""
    monkeypatch.setattr(config, "SMTP_HOST", "")
    monkeypatch.setattr(config, "MAGIC_LINK_DEV_ECHO", True)
    register(client, session)

    user = session.exec(select(User).where(User.email == "nuevo@example.com")).one()
    assert user.welcome_email_sent_at is None


def test_login_succeeds_even_if_mail_fails(client, session, monkeypatch):
    """メールの失敗でログインできなくなる方が損失が大きい"""
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(config, "SMTP_USER", "a@example.com")
    monkeypatch.setattr(config, "SMTP_PASSWORD", "x")

    def boom(**kw):
        raise mail_service.MailError("失敗")

    monkeypatch.setattr(mail_service, "send", boom)

    res = register(client, session)
    assert res.status_code == 200
    assert res.json()["access_token"]

    user = session.exec(select(User).where(User.email == "nuevo@example.com")).one()
    # 送信済みにしない。次回のログインで再試行される
    assert user.welcome_email_sent_at is None


# ---------------------------------------------------------------- 枠が無いとき

def test_no_slot_email_does_not_promise_the_bonus(client, session, sent):
    """約束できないことを書かない"""
    from tests.conftest import set_campaign

    set_campaign(session, slot_limit=0)
    register(client, session)

    body = sent[0]["body"]
    assert "agotaron" in body
    assert "Reservamos" not in body
