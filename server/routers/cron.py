"""定時実行から叩くエンドポイント。

papuntoにはジョブキューが無いので、GitHub Actions の cron から HTTP で叩く
（papunto-sns の post.yml と同じ形）。

⚠️ 認証は共有シークレット1本。管理者トークンを使わないのは、CIの秘密に
   人のアカウントの権限を持たせたくないため。漏れても**できることは
   この経路の実行だけ**に閉じる。
"""
import hmac
import logging

from fastapi import APIRouter, Depends, Header
from sqlmodel import Session

import config
from database import get_session
from errors import ApiError
from services import reminder_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cron", tags=["cron"])


def require_cron_secret(x_cron_secret: str | None = Header(default=None)) -> None:
    # 未設定を「認証スキップ」にしない。誰でも叩けるようになる
    if not config.CRON_SECRET:
        logger.error("CRON_SECRET が未設定のため定時実行を拒否した")
        raise ApiError(503, "CRON_DISABLED", "Cron no está configurado")
    if not x_cron_secret or not hmac.compare_digest(x_cron_secret, config.CRON_SECRET):
        raise ApiError(403, "INVALID_CRON_SECRET", "Secreto inválido")


@router.post("/reservation-reminders", dependencies=[Depends(require_cron_secret)])
def reservation_reminders(session: Session = Depends(get_session)):
    """枠の期限が近い人にメールを送る。

    毎日1回叩かれる想定。送信済みを記録するので、複数回叩かれても重複しない。
    """
    return reminder_service.send_reminders(session)
