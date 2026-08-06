import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

import config
from errors import ApiError
from models import Postback, PostbackLog, User
from models.postback import (
    STATUS_APPROVED,
    STATUS_PENDING,
    STATUS_REJECTED,
    TERMINAL_STATUSES,
)

logger = logging.getLogger("postback")


def log_callback(
    session: Session,
    *,
    provider: str,
    params: dict[str, Any],
    http_method: str,
    remote_ip: str,
    verified: bool,
    signature: Optional[str] = None,
    transaction_id: Optional[str] = None,
) -> PostbackLog:
    """ポストバックの生ペイロードを記録する。検証に失敗したものも残す。

    付与処理と同じセッションを使うが、ここで一度commitして確定させる。付与側で例外を投げても
    「届いたが付与しなかった」記録が消えないようにするため
    """
    log = PostbackLog(
        provider=provider,
        transaction_id=transaction_id,
        http_method=http_method,
        params=params,
        signature=signature,
        verified=verified,
        remote_ip=remote_ip,
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return log


def parse_userid(userid: str) -> int:
    """ポストバックのユーザーIDを整数に変換する。

    生のクエリ文字列由来なので数値とは限らない。int()をそのまま呼ぶと
    ValueErrorが素通りして500になり、送信元からは一時的な障害と区別がつかない
    """
    try:
        return int(userid)
    except (TypeError, ValueError):
        raise ApiError(422, "INVALID_USERID", "Invalid userid")


def process_conversion(
    session: Session,
    *,
    provider: str,
    userid: str,
    transaction_id: str,
    reward_points: int,
    status: str,
    payout_usd: Optional[Decimal] = None,
    campaign_id: Optional[str] = None,
    campaign_name: Optional[str] = None,
) -> None:
    """成果1件を記録し、承認済みならポイントを付与する。

    Monlix / CPALead 双方から使う。ポイント付与とステータス遷移は同一トランザクションで
    commitする。片方だけ確定すると、次のポストバックで再付与される
    """
    user_id = parse_userid(userid)

    # 報酬0は正常なポストバックとして起こりうる。「インストール後に初回起動」のような案件では
    # インストール時点で報酬0、初回起動時点で報酬ありと複数回に分かれて届く。エラーではないので
    # 通知せず、付与対象外として成果を作らずに返す（生ログは残っているので後追いはできる）
    if reward_points <= 0:
        return

    if reward_points > config.MAX_REWARD_POINTS:
        logger.error(
            "Postback reward exceeds ceiling, skipped: provider=%s transaction_id=%s points=%s ceiling=%s",
            provider, transaction_id, reward_points, config.MAX_REWARD_POINTS,
        )
        return

    now = datetime.now(timezone.utc)

    postback = session.exec(
        select(Postback)
        .where(Postback.provider == provider, Postback.transaction_id == transaction_id)
        .with_for_update()
    ).first()

    if postback is not None and postback.status in TERMINAL_STATUSES:
        # 同一の成果に複数回ポストバックが届きうる（状態遷移＋送信失敗時の再送）。
        # 終端状態に達したあとは何もしないことで、二重付与とステータスの巻き戻りを防ぐ
        return

    if postback is None:
        postback = Postback(
            provider=provider,
            transaction_id=transaction_id,
            user_id=user_id,
            reward_points=reward_points,
            payout_usd=payout_usd,
            campaign_id=campaign_id,
            campaign_name=campaign_name,
            status=STATUS_PENDING,
            created_at=now,
            updated_at=now,
        )
        session.add(postback)
    else:
        # 未承認で先に届いていた成果。報酬額は承認時の通知が正とする
        postback.reward_points = reward_points
        postback.payout_usd = payout_usd
        postback.campaign_id = campaign_id or postback.campaign_id
        postback.campaign_name = campaign_name or postback.campaign_name

    postback.updated_at = now

    if status == STATUS_APPROVED:
        user = session.exec(
            select(User).where(User.id == user_id).with_for_update()
        ).first()
        if user is None:
            logger.warning("Postback for unknown user: provider=%s userid=%s", provider, userid)
            raise ApiError(404, "USER_NOT_FOUND", "User not found")
        user.points += reward_points
        postback.status = STATUS_APPROVED
        postback.approved_at = now
    elif status == STATUS_REJECTED:
        postback.status = STATUS_REJECTED
        postback.rejected_at = now
    else:
        postback.status = STATUS_PENDING

    try:
        session.commit()
    except IntegrityError:
        # 並行して届いたポストバックが先にINSERTを終えたケース。処理済みなので成功として返す
        session.rollback()
