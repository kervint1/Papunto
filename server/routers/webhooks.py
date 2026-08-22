import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse
from sqlmodel import Session

import config
from database import get_session
from errors import ApiError
from services import email_event_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/resend", response_class=PlainTextResponse)
async def resend_webhook(request: Request, session: Session = Depends(get_session)):
    """Resendの配信イベントを受ける。

    受けたいのは `email.bounced` と `email.complained`。以後そのアドレスへ
    送らないようにするために使う（送り続けると送信ドメインの評判が落ちる）。

    ⚠️ 署名の検証には**生のボディ**が要るので `await request.body()` で取る。
       FastAPIにPydanticで受けさせるとキーの順序や空白が変わって検証が落ちる。
    """
    body = await request.body()

    verified = email_event_service.verify_signature(
        secret=config.RESEND_WEBHOOK_SECRET,
        svix_id=request.headers.get("svix-id"),
        svix_timestamp=request.headers.get("svix-timestamp"),
        svix_signature=request.headers.get("svix-signature"),
        body=body,
    )
    if not verified:
        # 記録も残さない。誰でも呼べるエンドポイントなので、残すと
        # ログテーブルを外部から膨らませられる（1万行上限に効く）
        logger.warning("Resend webhook の署名検証に失敗")
        raise ApiError(403, "INVALID_SIGNATURE", "Firma inválida")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise ApiError(422, "INVALID_PAYLOAD", "Payload inválido")
    if not isinstance(payload, dict):
        raise ApiError(422, "INVALID_PAYLOAD", "Payload inválido")

    rows = email_event_service.record(session, payload=payload)
    session.commit()

    for row in rows:
        if row.event_type in email_event_service.BLOCKING_EVENTS:
            # 管理者が気づけるように残す。通知先が用意できたらここから飛ばす
            logger.warning(
                "メールが届かない: email=%s type=%s bounce=%s reason=%s",
                row.email,
                row.event_type,
                row.bounce_type,
                row.reason,
            )

    return "OK"
