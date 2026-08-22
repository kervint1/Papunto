"""登録完了メール。

事前登録の期間中は**アプリを見せない**（中にタスクが1件も無いため）。
そのぶん、登録した実感が残るのはこのメールだけになる。確実に1通送り、
2通は送らない。

⚠️ 送れなかったときに「送信済み」を記録しないこと。記録すると二度と
   送れなくなる。SMTPが未設定の環境（ローカル）では単に送らない。
"""
import datetime as dt
import logging

from sqlmodel import Session

import config
from models import User
from services import campaign_service, mail_service

logger = logging.getLogger(__name__)


def _body(session: Session, user: User) -> str:
    settings = campaign_service.get_settings(session)
    opens = campaign_service.withdrawals_open_at(session)
    initial = settings.reward_points_initial
    bonus = settings.reward_points_bonus
    total = initial + bonus
    site = config.FRONTEND_ORIGIN

    # 宛名。無ければ省く。「Hola ,」になるより挨拶ごと無い方がまし。
    # マジックリンクで登録した人は提供元から名前が来ないので空のことが多い
    saludo = f"Hola {user.name},\n\n" if user.name else ""

    if user.campaign_reserved_at is None:
        # 枠が埋まった後に登録した人。約束できないことを書かない
        return (
            saludo
            + "Gracias por crear tu cuenta en Papunto.\n\n"
            "Los cupos del pre-registro ya se agotaron, así que esta vez no "
            "pudimos reservarte el bono. Te avisaremos por correo cuando "
            "abramos las tareas y cuando haya nuevos cupos.\n\n"
            f"Tu cuenta: {site}\n"
        )

    fecha = opens.strftime("%d/%m/%Y") if opens else "el lanzamiento"
    return (
        saludo
        + f"Listo, estás dentro de los {settings.slot_limit} del pre-registro.\n\n"
        f"Reservamos S/ {total / 100:.2f} para ti.\n\n"
        "Cómo recibirlos:\n\n"
        f"1. Registra el número de Yape donde quieres cobrar. "
        f"Te acreditamos {initial} puntos al instante.\n"
        f"2. El {fecha} abrimos las tareas. Completa 1 tarea y recibes "
        f"{bonus} puntos más.\n"
        f"3. Desde {total} puntos puedes cobrar por Yape.\n\n"
        "Hasta entonces no tienes que hacer nada más. Te avisaremos por "
        "correo cuando abramos.\n\n"
        f"Tu cuenta: {site}\n"
        f"Bases de la campaña: {site}/campana\n"
    )


def send_if_needed(session: Session, user: User) -> bool:
    """登録完了メールを1通だけ送る。送ったら True。

    commitまで行う（送信後に記録が残らないと二重送信になる）
    """
    if user.welcome_email_sent_at is not None:
        return False
    if not mail_service.configured():
        # ローカルなど。記録しないので、SMTPを入れれば次回送られる
        return False

    try:
        mail_service.send(
            to=user.email,
            subject="Estás dentro del pre-registro de Papunto",
            body=_body(session, user),
        )
    except mail_service.MailError:
        # ログインは成功させる。メールの失敗で入れなくなる方が損失が大きい
        logger.error("登録完了メールを送れなかった: user=%s", user.id)
        return False

    user.welcome_email_sent_at = dt.datetime.now(dt.timezone.utc)
    session.add(user)
    session.commit()
    return True
