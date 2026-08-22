"""メール送信。

⚠️ SMTPが未設定のときに黙って成功しないこと。ログインの唯一の手段が
   メールになる場面があるので、「送ったつもりで届いていない」が一番危ない。
"""
import logging
import smtplib
from email.message import EmailMessage

import config

logger = logging.getLogger(__name__)


class MailError(RuntimeError):
    pass


def configured() -> bool:
    return bool(config.SMTP_HOST and config.SMTP_USER and config.SMTP_PASSWORD)


def send(*, to: str, subject: str, body: str) -> None:
    if not configured():
        raise MailError("SMTPが未設定")

    # 退会したアカウントのアドレスには送らない。
    # 退会時に deleted+<id>@deleted.invalid へ書き換えているので配送されないが、
    # 送ろうとすること自体が無駄なうえ、バウンスが積もると送信ドメインの
    # 評価が落ちる（ticketjam の DeletedUserMailInterceptor と同じ考え）
    if to.endswith("@deleted.invalid"):
        logger.info("退会済みのアドレスなので送らない: to=%s", to)
        return

    message = EmailMessage()
    message["From"] = config.MAIL_FROM or config.SMTP_USER
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        # 例外の中身に認証情報が載ることがあるので、そのまま外へ出さない
        logger.error("メール送信に失敗: to=%s error=%s", to, type(exc).__name__)
        raise MailError("メール送信に失敗") from exc

    logger.info("メール送信: to=%s subject=%s", to, subject)
