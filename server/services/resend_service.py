"""ResendのHTTP API。送信そのものはSMTPで行うので、ここは抑制リストの操作だけ。

一度ハードバウンスするとResend側の抑制リストに載り、**原因を直しても
以後は送信されない**。ダッシュボードで手作業で消すこともできるが、
それだと利用者が「何度押しても届かない」まま放置される。

ticketjam（`app/jobs/email_bounce_checker_job.rb`）と同じく、
再送を要求された時点でこちらから消しに行く。
"""
import logging

import requests

import config

logger = logging.getLogger(__name__)

API_BASE = "https://api.resend.com"


def configured() -> bool:
    return bool(config.RESEND_API_KEY)


def remove_suppression(email: str) -> bool:
    """抑制リストからアドレスを外す。成功したらTrue。

    ⚠️ 失敗しても例外にしない。ここで落とすとログイン処理ごと止まるが、
       本来やりたいのは「送信を試みること」なので、外せなくても先へ進む。
    """
    if not configured():
        logger.warning("RESEND_API_KEY が未設定のため抑制リストを操作できない")
        return False

    try:
        res = requests.delete(
            f"{API_BASE}/suppressions/{email}",
            headers={"Authorization": f"Bearer {config.RESEND_API_KEY}"},
            timeout=10,
        )
    except requests.RequestException as exc:
        logger.error("抑制リストの解除に失敗: email=%s error=%s", email, type(exc).__name__)
        return False

    # 元から載っていなければ404。こちらの記録だけ古かった場合なので成功扱いでよい
    if res.status_code == 404:
        return True
    if not res.ok:
        logger.error("抑制リストの解除に失敗: email=%s status=%s", email, res.status_code)
        return False

    logger.info("抑制リストから解除: email=%s", email)
    return True
