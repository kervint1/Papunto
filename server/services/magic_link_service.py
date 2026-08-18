"""メールのマジックリンク。

集客はFacebookグループとWhatsApp。**そのアプリ内ブラウザでは
Googleログインが動かない**（Googleが埋め込みWebViewでのOAuthを拒否する。
403 disallowed_useragent。こちらの設定では回避できない）。

マジックリンクはOAuthを経由しないので、どのブラウザでも通る。
外部の審査も要らないため、確実に用意できる唯一の手段。

## 設計

- 生のトークンは**保存しない**（sha256だけ）。DBが漏れてもログインできない
- **1回きり**。転送・漏洩しても再利用されない
- 期限は短い（既定15分）
- 同じメールへの連続要求を制限する。他人のメールに大量送信させないため
"""
import datetime as dt
import hashlib
import logging
import secrets

from sqlmodel import Session, func, select

import config
from models import MagicLinkToken

logger = logging.getLogger(__name__)

TOKEN_TTL = dt.timedelta(minutes=15)
# 同じメールにこの時間内でこの回数まで
RATE_WINDOW = dt.timedelta(minutes=10)
RATE_LIMIT = 3


class MagicLinkError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _aware(value: dt.datetime) -> dt.datetime:
    """DBから戻る naive な datetime を UTC として扱う"""
    return value if value.tzinfo else value.replace(tzinfo=dt.timezone.utc)


def issue(session: Session, email: str) -> str:
    """トークンを発行して**生の値**を返す。呼び出し元がメールで送る。

    commitまで行う（送信前に記録を確定させる。記録が無いまま送ると検証できない）
    """
    normalized = email.strip().lower()

    recent = int(
        session.exec(
            select(func.count())
            .select_from(MagicLinkToken)
            .where(
                MagicLinkToken.email == normalized,
                MagicLinkToken.created_at >= _now() - RATE_WINDOW,
            )
        ).one()
    )
    if recent >= RATE_LIMIT:
        # 他人のメールアドレスに大量送信させないための制限
        raise MagicLinkError(
            "TOO_MANY_REQUESTS",
            "Espera unos minutos antes de pedir otro enlace.",
        )

    raw = secrets.token_urlsafe(32)
    session.add(
        MagicLinkToken(
            email=normalized,
            token_hash=_hash(raw),
            expires_at=_now() + TOKEN_TTL,
        )
    )
    session.commit()
    logger.info("magic link issued: email=%s", normalized)
    return raw


def consume(session: Session, raw: str) -> str:
    """トークンを使い、対応するメールアドレスを返す。

    ⚠️ 検証と使用済みマークを**同じトランザクション**で行う。分けると
       同じリンクを2回踏んだときに二重にログインできる
    """
    record = session.exec(
        select(MagicLinkToken).where(MagicLinkToken.token_hash == _hash(raw))
    ).first()

    if record is None:
        raise MagicLinkError("INVALID_TOKEN", "El enlace no es válido.")
    if record.used_at is not None:
        raise MagicLinkError("TOKEN_USED", "Este enlace ya se usó. Pide uno nuevo.")
    if _aware(record.expires_at) < _now():
        raise MagicLinkError("TOKEN_EXPIRED", "El enlace expiró. Pide uno nuevo.")

    record.used_at = _now()
    session.add(record)
    session.commit()
    logger.info("magic link consumed: email=%s", record.email)
    return record.email


def build_url(raw: str) -> str:
    return f"{config.FRONTEND_ORIGIN}/ingresar/verificar?token={raw}"
