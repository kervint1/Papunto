"""配信結果Webhook（Resend）の検証・記録・ブロック。

守りたいのは2つ。

1. **署名が通らないものを記録しない。** 誰でも叩けるので、記録すると
   外部からログテーブルを膨らませられる（Heroku Postgresの1万行上限に効く）
2. **soft バウンスでブロックしない。** 受信箱が一杯だっただけの人を
   永久に締め出してしまう
"""
import base64
import hashlib
import hmac
import json
import time

import pytest
from sqlmodel import Session, select

import config
from models.email_event import EmailEvent
from services import email_event_service, resend_service

SECRET = "whsec_" + base64.b64encode(b"0123456789abcdef0123456789abcdef").decode()


@pytest.fixture(autouse=True)
def webhook_secret(monkeypatch):
    monkeypatch.setattr(config, "RESEND_WEBHOOK_SECRET", SECRET)


def sign(body: bytes, svix_id: str = "msg_1", timestamp: str | None = None) -> dict:
    """Resendと同じ手順で署名したヘッダを作る"""
    ts = timestamp or str(int(time.time()))
    key = base64.b64decode(SECRET[len("whsec_") :])
    signed = f"{svix_id}.{ts}.".encode() + body
    digest = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
    return {
        "svix-id": svix_id,
        "svix-timestamp": ts,
        "svix-signature": f"v1,{digest}",
    }


def payload(
    event_type: str = "email.bounced",
    email: str = "roto@example.com",
    bounce_type: str = "hard",
) -> dict:
    return {
        "type": event_type,
        "created_at": "2026-08-22T00:00:00.000Z",
        "data": {
            "email_id": "e-1",
            "from": "Papunto <noreply@papunto.pe>",
            "to": [email],
            "subject": "Tu enlace para entrar a Papunto",
            "bounce": {"type": bounce_type, "message": "Mailbox does not exist"},
        },
    }


def post(client, body: dict, headers: dict | None = None):
    raw = json.dumps(body).encode()
    return client.post(
        "/webhooks/resend",
        content=raw,
        headers={"content-type": "application/json", **(headers or sign(raw))},
    )


# ------------------------------------------------------------------ 署名検証

def test_署名が正しければ記録される(client, session: Session):
    assert post(client, payload()).status_code == 200

    row = session.exec(select(EmailEvent)).first()
    assert row is not None
    assert row.event_type == "email.bounced"
    assert row.email == "roto@example.com"
    assert row.bounce_type == "hard"


def test_署名が違えば拒否して記録しない(client, session: Session):
    raw = json.dumps(payload()).encode()
    headers = sign(raw)
    headers["svix-signature"] = "v1,YWJjZGVm"

    res = client.post("/webhooks/resend", content=raw, headers=headers)

    assert res.status_code == 403
    # 誰でも叩けるので、失敗したものは残さない
    assert session.exec(select(EmailEvent)).first() is None


def test_署名ヘッダが無ければ拒否する(client, session: Session):
    raw = json.dumps(payload()).encode()
    res = client.post("/webhooks/resend", content=raw)

    assert res.status_code == 403
    assert session.exec(select(EmailEvent)).first() is None


def test_シークレット未設定なら拒否する(client, session: Session, monkeypatch):
    """未設定を「検証スキップ」にすると、誰でも任意のアドレスをブロックできる
    ＝任意のユーザーのログインを妨害できてしまう"""
    monkeypatch.setattr(config, "RESEND_WEBHOOK_SECRET", "")

    raw = json.dumps(payload()).encode()
    res = client.post("/webhooks/resend", content=raw, headers=sign(raw))

    assert res.status_code == 403
    assert session.exec(select(EmailEvent)).first() is None


def test_古いタイムスタンプは拒否する(client, session: Session):
    """署名対象に時刻が入っているので、再生攻撃を弾ける"""
    raw = json.dumps(payload()).encode()
    old = str(int(time.time()) - 60 * 60)

    res = client.post("/webhooks/resend", content=raw, headers=sign(raw, timestamp=old))

    assert res.status_code == 403


def test_署名は複数値のうち1つ一致すればよい(client, session: Session):
    """鍵のローテーション中は v1 が2つ入る"""
    raw = json.dumps(payload()).encode()
    headers = sign(raw)
    headers["svix-signature"] = f"v1,YWJjZGVm {headers['svix-signature']}"

    assert client.post("/webhooks/resend", content=raw, headers=headers).status_code == 200


def test_ボディを1バイトでも変えると通らない(client, session: Session):
    """生ボディで検証していることの確認。パースして作り直すと落ちる"""
    raw = json.dumps(payload()).encode()
    headers = sign(raw)

    res = client.post("/webhooks/resend", content=raw + b" ", headers=headers)

    assert res.status_code == 403


# -------------------------------------------------------------- ブロック判定

def test_ハードバウンスでブロックされる(client, session: Session):
    post(client, payload(bounce_type="hard"))
    assert email_event_service.is_blocked(session, "roto@example.com") is True


def test_softバウンスではブロックしない(client, session: Session):
    """受信箱が一杯なだけの人を永久に締め出さない"""
    post(client, payload(bounce_type="soft"))
    assert email_event_service.is_blocked(session, "roto@example.com") is False


def test_迷惑メール報告でブロックされる(client, session: Session):
    """再送するほど送信ドメインの評判が落ちるので止める"""
    post(client, payload(event_type="email.complained", bounce_type=""))
    assert email_event_service.is_blocked(session, "roto@example.com") is True


def test_配信成功ではブロックしない(client, session: Session):
    post(client, payload(event_type="email.delivered", bounce_type=""))
    assert email_event_service.is_blocked(session, "roto@example.com") is False


def test_大文字小文字を無視して判定する(client, session: Session):
    post(client, payload(email="Roto@Example.com"))
    assert email_event_service.is_blocked(session, "roto@example.com") is True


def test_解除するとブロックが外れる(client, session: Session):
    post(client, payload())
    assert email_event_service.is_blocked(session, "roto@example.com") is True

    assert email_event_service.clear(session, "roto@example.com") == 1
    session.commit()

    assert email_event_service.is_blocked(session, "roto@example.com") is False


def test_宛先が複数なら宛先ごとに1行にする(client, session: Session):
    """照合はアドレス単位なので、配列のまま持つと後から引けない"""
    body = payload()
    body["data"]["to"] = ["a@example.com", "b@example.com"]
    post(client, body)

    rows = session.exec(select(EmailEvent)).all()
    assert {r.email for r in rows} == {"a@example.com", "b@example.com"}


def test_バウンスの形が別でも種別を拾う(client, session: Session):
    """Resendの資料に bounce_type / bounce_reason の形も出てくる"""
    body = payload()
    del body["data"]["bounce"]
    body["data"]["bounce_type"] = "hard"
    body["data"]["bounce_reason"] = "Mailbox does not exist"
    post(client, body)

    row = session.exec(select(EmailEvent)).first()
    assert row.bounce_type == "hard"
    assert row.reason == "Mailbox does not exist"


# ------------------------------------------------------- マジックリンクとの連動

@pytest.fixture(name="removed")
def removed_fixture(monkeypatch):
    """抑制リストの解除を呼んだアドレスを記録する（外部APIは叩かない）"""
    calls: list[str] = []
    monkeypatch.setattr(
        resend_service, "remove_suppression", lambda email: calls.append(email) or True
    )
    monkeypatch.setattr(config, "MAGIC_LINK_DEV_ECHO", True)
    return calls


def test_バウンス後は抑制を解除して送り直す(client, session: Session, removed):
    """抑制リストに載ったままだと何度送っても届かない。
    原因が直っていることを期待して、こちらから外して送る"""
    post(client, payload(email="roto@example.com"))

    res = client.post("/api/v1/auth/magic-link", json={"email": "roto@example.com"})

    assert res.status_code == 200
    assert removed == ["roto@example.com"]
    # こちら側の記録も解除されている
    assert email_event_service.is_blocked(session, "roto@example.com") is False


def test_解除の上限を超えたら諦める(client, session: Session, removed):
    """存在しないアドレスに送り続けると、送信ドメインの評価が落ちる。
    papunto.pe は実績がゼロなので、評価が育つ前に潰れる"""
    for _ in range(email_event_service.AUTO_CLEAR_LIMIT):
        post(client, payload(email="roto@example.com"))
        assert (
            client.post("/api/v1/auth/magic-link", json={"email": "roto@example.com"}).status_code
            == 200
        )

    # 上限に達した状態でもう一度バウンスさせる
    post(client, payload(email="roto@example.com"))
    res = client.post("/api/v1/auth/magic-link", json={"email": "roto@example.com"})

    assert res.status_code == 422
    assert res.json()["error"]["code"] == "MAIL_BLOCKED"
    # 諦めた回では解除を呼んでいない
    assert len(removed) == email_event_service.AUTO_CLEAR_LIMIT


def test_softバウンスなら解除もしない(client, session: Session, removed):
    """そもそもブロックしていないので、抑制リストを触る必要がない"""
    post(client, payload(bounce_type="soft"))

    res = client.post("/api/v1/auth/magic-link", json={"email": "roto@example.com"})

    assert res.status_code == 200
    assert removed == []


def test_バウンスしていなければ解除を呼ばない(client, session: Session, removed):
    res = client.post("/api/v1/auth/magic-link", json={"email": "ok@example.com"})

    assert res.status_code == 200
    assert removed == []
