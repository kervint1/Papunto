"""メール配信イベント（Webhook）の検証と記録。

ResendのWebhookは Svix 形式で届く。署名は

    base64(HMAC-SHA256(secret, f"{svix-id}.{svix-timestamp}.{生ボディ}"))

で、`svix-signature` ヘッダは `v1,<署名>` を空白区切りで複数持ちうる
（鍵のローテーション中に両方が入る）。**どれか1つ一致すれば正当**。
"""
import base64
import hashlib
import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlmodel import Session, select

from models.email_event import EmailEvent

logger = logging.getLogger(__name__)

# 以後の送信を止めるイベント。
# soft バウンス（受信箱が一杯など）は時間で回復するので**含めない**。
# email.complained（迷惑メール報告）は再送するほど評判が落ちるので止める。
BLOCKING_EVENTS = {"email.bounced", "email.complained"}

# 署名対象に時刻が入っているので、古い配送は再生攻撃として弾く。Svixの推奨値
TIMESTAMP_TOLERANCE = timedelta(minutes=5)


def _secret_bytes(secret: str) -> bytes:
    """`whsec_` を外して base64 デコードする。

    Svixの署名鍵は `whsec_` の後ろが base64。プレフィックスを付けたまま
    HMACに渡すと、検証は常に失敗するのに例外は出ないので気づきにくい。
    """
    raw = secret[len("whsec_") :] if secret.startswith("whsec_") else secret
    return base64.b64decode(raw)


def verify_signature(
    *,
    secret: str,
    svix_id: Optional[str],
    svix_timestamp: Optional[str],
    svix_signature: Optional[str],
    body: bytes,
    now: Optional[datetime] = None,
) -> bool:
    """Svix署名を検証する。

    ⚠️ `body` は**生のバイト列**を渡すこと。JSONにパースして再度文字列化すると
       キーの順序や空白が変わって必ず失敗する。
    """
    # シークレット未設定を「検証スキップ」にしない。誰でも任意のアドレスを
    # ブロックできてしまう（= 任意のユーザーのログインを妨害できる）
    if not secret or not svix_id or not svix_timestamp or not svix_signature:
        return False

    try:
        sent_at = datetime.fromtimestamp(int(svix_timestamp), tz=timezone.utc)
    except (ValueError, OverflowError, OSError):
        return False

    current = now or datetime.now(timezone.utc)
    if abs(current - sent_at) > TIMESTAMP_TOLERANCE:
        return False

    try:
        key = _secret_bytes(secret)
    except (ValueError, base64.binascii.Error):
        logger.error("Webhookのシークレットがbase64として不正")
        return False

    signed = f"{svix_id}.{svix_timestamp}.".encode() + body
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()

    for part in svix_signature.split():
        # "v1,<署名>" 形式。バージョン部分が違うものは無視する
        version, _, value = part.partition(",")
        if version != "v1":
            continue
        if hmac.compare_digest(value, expected):
            return True
    return False


def _extract_bounce(data: dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
    """バウンスの種別と理由を取り出す。

    ⚠️ Resendは `bounce: {type, message}` と `bounce_type` / `bounce_reason` の
       両方の形が資料に出てくる。実際に届いたペイロードを見て確定させるまで、
       どちらでも拾えるようにしておく。取れなくても payload に生を残してある。
    """
    bounce = data.get("bounce")
    if isinstance(bounce, dict):
        return (
            bounce.get("type") or bounce.get("subType"),
            bounce.get("message") or bounce.get("reason"),
        )
    return data.get("bounce_type"), data.get("bounce_reason")


def record(session: Session, *, payload: dict[str, Any], provider: str = "resend") -> list[EmailEvent]:
    """Webhookのペイロードを記録する。commitはしない（呼び出し側でまとめる）。

    宛先が複数あるイベントは**宛先ごとに1行**にする。照合はメールアドレス単位で
    行うため、配列のまま持つと後から引けない。
    """
    event_type = str(payload.get("type") or "unknown")
    data = payload.get("data") or {}
    recipients = data.get("to") or []
    if isinstance(recipients, str):
        recipients = [recipients]

    bounce_type, reason = _extract_bounce(data)

    rows: list[EmailEvent] = []
    for address in recipients:
        row = EmailEvent(
            provider=provider,
            event_type=event_type,
            email=str(address).strip().lower(),
            email_id=data.get("email_id"),
            bounce_type=bounce_type,
            reason=reason,
            payload=payload,
        )
        session.add(row)
        rows.append(row)
    return rows


def is_blocked(session: Session, email: str) -> bool:
    """このアドレスへの送信を止めるべきか。

    ハードバウンスと迷惑メール報告だけを見る。soft バウンスは時間で回復するので
    含めない（含めると受信箱が一杯だった人が永久に締め出される）。
    """
    normalized = email.strip().lower()
    row = session.exec(
        select(EmailEvent)
        .where(EmailEvent.email == normalized)
        .where(EmailEvent.event_type.in_(BLOCKING_EVENTS))
        .where(EmailEvent.cleared_at.is_(None))
        # softバウンスは event_type が email.bounced でも回復するので除外する。
        # 種別が取れなかったもの（None）は安全側に倒してブロック対象にする
        .where((EmailEvent.bounce_type.is_(None)) | (EmailEvent.bounce_type != "soft"))
    ).first()
    return row is not None


def clear(session: Session, email: str) -> int:
    """ブロックを解除する。解除した件数を返す。commitはしない。

    ⚠️ これは**こちら側の記録を消すだけ**。提供元（Resend）の抑制リストは
       別に残っているので、ダッシュボードでも消さないと送信されない。
    """
    normalized = email.strip().lower()
    rows = session.exec(
        select(EmailEvent)
        .where(EmailEvent.email == normalized)
        .where(EmailEvent.cleared_at.is_(None))
        .where(EmailEvent.event_type.in_(BLOCKING_EVENTS))
    ).all()
    now = datetime.now(timezone.utc)
    for row in rows:
        row.cleared_at = now
        session.add(row)
    return len(rows)
