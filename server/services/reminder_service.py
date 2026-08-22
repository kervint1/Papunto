"""枠の期限が近い人へのリマインド。

枠は7日で失効する。画面には期限を出しているが、**ログインしない人には
届かない**。登録して放置している人こそ知らせる相手なので、メールで送る。

定時実行から呼ぶ（GitHub Actions の cron → POST /cron/reservation-reminders）。
"""
import datetime as dt
import logging

from sqlmodel import Session, select

import config
from models import User
from services import campaign_service, mail_service

logger = logging.getLogger(__name__)

# 期限までこの時間を切ったら送る。
#
# ⚠️ 定時実行の間隔（1日）より**必ず広く取る**。同じ幅にすると、実行が
#    1回失敗しただけで誰にも届かないまま期限が過ぎる。
REMIND_WITHIN = dt.timedelta(days=2)


def _body(user: User, deadline: dt.datetime, initial: int) -> str:
    saludo = f"Hola {user.name},\n\n" if user.name else ""
    fecha = deadline.strftime("%d/%m/%Y")
    return (
        saludo
        + "Tu cupo del pre-registro de Papunto vence pronto.\n\n"
        f"Tienes hasta el {fecha} para registrar el número de celular con el "
        f"que vas a cobrar. Al registrarlo te acreditamos {initial} puntos "
        "al instante.\n\n"
        "Si no lo registras antes de esa fecha, el cupo queda libre y pasa "
        "a la siguiente persona.\n\n"
        f"Regístralo aquí: {config.FRONTEND_ORIGIN}\n"
    )


def pending(session: Session, *, now: dt.datetime | None = None) -> list[User]:
    """いま送るべき相手。

    枠を持っていて、まだ受け取っておらず、期限が近く、まだ送っていない人。
    """
    now = now or dt.datetime.now(dt.timezone.utc)
    settings = campaign_service.get_settings(session)
    # 期限 = campaign_reserved_at + reservation_days。
    # 「期限まで REMIND_WITHIN を切った」= 確保時刻が下の境界より古い
    umbral = now - dt.timedelta(days=settings.reservation_days) + REMIND_WITHIN
    return list(
        session.exec(
            select(User)
            .where(
                User.campaign_reserved_at.is_not(None),
                User.campaign_reserved_at <= umbral,
                # 受け取り済みの枠は失効しないので送らない
                User.campaign_reward_granted_at.is_(None),
                User.reservation_reminder_sent_at.is_(None),
                User.campaign_excluded == False,  # noqa: E712
                User.deleted_at.is_(None),
                User.suspended_at.is_(None),
            )
            .order_by(User.campaign_reserved_at.asc())
        ).all()
    )


def send_reminders(session: Session, *, limit: int = 100) -> dict:
    """期限が近い人にメールを送る。送信した件数などを返す。

    ⚠️ `limit` を設けているのは、無料枠（Resendは100通/日）を1回の実行で
       使い切らないため。残りは次回に回る（送信済みを記録するので重複しない）。
    """
    if not mail_service.configured():
        logger.warning("SMTPが未設定のためリマインドを送らない")
        return {"sent": 0, "failed": 0, "skipped": "smtp_not_configured"}

    settings = campaign_service.get_settings(session)
    sent = 0
    failed = 0

    for user in pending(session)[:limit]:
        deadline = campaign_service.reservation_deadline(session, user)
        if deadline is None:
            continue
        try:
            mail_service.send(
                to=user.email,
                subject="Tu cupo de Papunto vence pronto",
                body=_body(user, deadline, settings.reward_points_initial),
            )
        except mail_service.MailError:
            # 記録しないので次回の実行で再試行される
            failed += 1
            logger.error("リマインドを送れなかった: user=%s", user.id)
            continue

        user.reservation_reminder_sent_at = dt.datetime.now(dt.timezone.utc)
        session.add(user)
        session.commit()
        sent += 1

    logger.info("枠の期限リマインド: sent=%s failed=%s", sent, failed)
    return {"sent": sent, "failed": failed}
