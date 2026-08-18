import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlmodel import Session, select

import config
from database import get_session
from dependencies import require_admin
from errors import ApiError
from models import AdminLog, Complaint, Post, Postback, PostbackLog, TopUp, User, Withdrawal
from schemas.admin import (
    AdminComplaintList,
    AdminComplaintRead,
    AdminLogList,
    AdminLogRead,
    AdminPostbackList,
    AdminPostbackLogList,
    AdminPostbackLogRead,
    AdminPostbackRead,
    AdminStats,
    AdminTopUpList,
    AdminTopUpRead,
    AdminUserDetail,
    AdminUserList,
    AdminUserRead,
    AdminWithdrawalList,
    AdminWithdrawalRead,
    Page,
    WithdrawalActionBody,
)
from schemas.offer import OfferList, OfferRead
from services import admin_service
from services.cpalead_service import CPALeadError, CPALeadService

# 依存をルーター単位で付ける。個別のエンドポイントで書き忘れても認可が外れないようにする
router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_admin)])
logger = logging.getLogger("admin")

PER_PAGE_MAX = 100

# 絞り込みに使える値。未知の値は弾かず「絞り込みなし」に倒す。
# 廃止した値をブックマークしていた場合に空振りするより、全件を見せた方が運用の邪魔にならない
WITHDRAWAL_STATUSES = {"pending", "completed", "rejected"}
POSTBACK_STATUSES = {"pending", "approved", "rejected"}
TOPUP_STATUSES = {"processing", "completed", "failed"}
COMPLAINT_STATUSES = {"pendiente", "respondido"}
PROVIDERS = {"monlix", "cpalead"}


def _valid(value: Optional[str], allowed: set[str]) -> Optional[str]:
    return value if value in allowed else None


# サイドバーのバッジ用の集計は全画面で叩かれるため、短時間だけキャッシュする。
# 8本のCOUNTが毎回走ると管理画面全体に固定コストとして乗る。件数が1分古くても運用上は困らない
_STATS_TTL_SECONDS = 60
_stats_cache: dict[str, Any] = {"at": 0.0, "value": None}


def _paginate(session: Session, statement, page: int, per_page: int):
    """一覧の共通処理。総件数を数えてから該当ページだけを取り出す"""
    total = session.exec(
        select(func.count()).select_from(statement.subquery())
    ).one()
    rows = session.exec(statement.offset((page - 1) * per_page).limit(per_page)).all()
    return rows, Page(page=page, per_page=per_page, total=total)


def _emails(session: Session, user_ids: list[int]) -> dict[int, str]:
    """一覧にユーザーのメールを添えるための一括取得（N+1を避ける）"""
    ids = [i for i in set(user_ids) if i is not None]
    if not ids:
        return {}
    rows = session.exec(select(User.id, User.email).where(User.id.in_(ids))).all()
    return {r[0]: r[1] for r in rows}


# ---------------------------------------------------------------- ダッシュボード

@router.get("/stats", response_model=AdminStats)
def stats(session: Session = Depends(get_session)):
    cached = _stats_cache["value"]
    if cached is not None and time.time() - _stats_cache["at"] < _STATS_TTL_SECONDS:
        return cached

    def count(model, *conditions):
        stmt = select(func.count()).select_from(model)
        for c in conditions:
            stmt = stmt.where(c)
        return session.exec(stmt).one()

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    result = AdminStats(
        users_total=count(User),
        users_new_7d=count(User, User.created_at >= week_ago),
        # 保有ポイントの総和。換金されると出ていく額なので、運営上いちばん見たい数字
        points_outstanding=session.exec(select(func.coalesce(func.sum(User.points), 0))).one(),
        withdrawals_pending=count(Withdrawal, Withdrawal.status == "pending"),
        topups_processing=count(TopUp, TopUp.status == "processing"),
        complaints_pendientes=count(Complaint, Complaint.status == "pendiente"),
        postbacks_pending=count(Postback, Postback.status == "pending"),
        postback_logs_unverified_7d=count(
            PostbackLog, PostbackLog.verified == False, PostbackLog.received_at >= week_ago  # noqa: E712
        ),
        posts_draft=count(Post, Post.status == "draft"),
        # ⚠️ 契約前は true が正しい設定。false にすると存在しないAPIを叩きに行く。
        #    危険なのは「サービスを公開したのに true のまま」というズレなので、
        #    値そのものを見せて判断できるようにする
        cpalead_mock=config.CPALEAD_MOCK,
        reloadly_sandbox=config.RELOADLY_SANDBOX,
    )
    _stats_cache["value"] = result
    _stats_cache["at"] = time.time()
    return result


def invalidate_stats_cache() -> None:
    """管理操作で件数が変わったときに即座に反映させる"""
    _stats_cache["value"] = None


# ---------------------------------------------------------------- ユーザー

@router.get("/users", response_model=AdminUserList)
def list_users(
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=PER_PAGE_MAX),
    session: Session = Depends(get_session),
):
    stmt = select(User)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(User.email.ilike(like) | User.name.ilike(like) | User.phone.ilike(like))
    stmt = stmt.order_by(User.created_at.desc())
    rows, meta = _paginate(session, stmt, page, per_page)
    return AdminUserList(
        users=[AdminUserRead.model_validate(r, from_attributes=True) for r in rows], page=meta
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def get_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if user is None:
        raise ApiError(404, "USER_NOT_FOUND", "Usuario no encontrado")

    postbacks = session.exec(
        select(Postback).where(Postback.user_id == user_id).order_by(Postback.created_at.desc()).limit(50)
    ).all()
    withdrawals = session.exec(
        select(Withdrawal).where(Withdrawal.user_id == user_id).order_by(Withdrawal.created_at.desc()).limit(50)
    ).all()
    topups = session.exec(
        select(TopUp).where(TopUp.user_id == user_id).order_by(TopUp.created_at.desc()).limit(50)
    ).all()

    return AdminUserDetail(
        user=AdminUserRead.model_validate(user, from_attributes=True),
        postbacks=[
            AdminPostbackRead.model_validate({**r.model_dump(), "user_email": user.email}) for r in postbacks
        ],
        withdrawals=[
            AdminWithdrawalRead.model_validate({**r.model_dump(), "user_email": user.email}) for r in withdrawals
        ],
        topups=[
            AdminTopUpRead.model_validate({**r.model_dump(), "user_email": user.email}) for r in topups
        ],
    )


# ---------------------------------------------------------------- 換金申請

@router.get("/withdrawals", response_model=AdminWithdrawalList)
def list_withdrawals(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=PER_PAGE_MAX),
    session: Session = Depends(get_session),
):
    stmt = select(Withdrawal)
    status = _valid(status, WITHDRAWAL_STATUSES)
    if status:
        stmt = stmt.where(Withdrawal.status == status)
    # 未処理を上に出す。運用で最初に見るのがpendingのため
    stmt = stmt.order_by(Withdrawal.created_at.desc())
    rows, meta = _paginate(session, stmt, page, per_page)
    emails = _emails(session, [r.user_id for r in rows])
    return AdminWithdrawalList(
        withdrawals=[
            AdminWithdrawalRead.model_validate({**r.model_dump(), "user_email": emails.get(r.user_id)})
            for r in rows
        ],
        page=meta,
    )


def _load_pending_withdrawal(session: Session, withdrawal_id: UUID) -> Withdrawal:
    withdrawal = session.exec(
        select(Withdrawal).where(Withdrawal.id == withdrawal_id).with_for_update()
    ).first()
    if withdrawal is None:
        raise ApiError(404, "WITHDRAWAL_NOT_FOUND", "Solicitud no encontrada")
    if withdrawal.status != "pending":
        # 二重処理の防止。すでに送金済みのものを再度承認すると経理が合わなくなる
        raise ApiError(409, "ALREADY_PROCESSED", "Esta solicitud ya fue procesada")
    return withdrawal


@router.post("/withdrawals/{withdrawal_id}/approve", response_model=AdminWithdrawalRead)
def approve_withdrawal(
    withdrawal_id: UUID,
    body: WithdrawalActionBody,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Yapeで送金した後に押す。ポイントは申請時点で差し引き済みなので残高は動かさない"""
    withdrawal = _load_pending_withdrawal(session, withdrawal_id)

    withdrawal.status = "completed"
    withdrawal.updated_at = datetime.now(timezone.utc)
    admin_service.log_action(
        session,
        admin=admin,
        action="withdrawal.approve",
        target_type="withdrawal",
        target_id=str(withdrawal.id),
        detail={
            "user_id": withdrawal.user_id,
            "points": withdrawal.points,
            "amount_soles": str(withdrawal.amount_soles),
            "yape_phone": withdrawal.yape_phone,
        },
        note=body.note,
    )
    invalidate_stats_cache()
    session.commit()
    session.refresh(withdrawal)
    logger.info("withdrawal approved: id=%s by admin=%s", withdrawal.id, admin.id)
    return AdminWithdrawalRead.model_validate(
        {**withdrawal.model_dump(), "user_email": None}
    )


@router.post("/withdrawals/{withdrawal_id}/reject", response_model=AdminWithdrawalRead)
def reject_withdrawal(
    withdrawal_id: UUID,
    body: WithdrawalActionBody,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """却下する。ポイントは申請時に差し引かれているため、ここで必ず返還する"""
    withdrawal = _load_pending_withdrawal(session, withdrawal_id)

    user = session.exec(
        select(User).where(User.id == withdrawal.user_id).with_for_update()
    ).first()
    if user is None:
        raise ApiError(404, "USER_NOT_FOUND", "Usuario no encontrado")

    user.points += withdrawal.points
    withdrawal.status = "rejected"
    withdrawal.updated_at = datetime.now(timezone.utc)
    admin_service.log_action(
        session,
        admin=admin,
        action="withdrawal.reject",
        target_type="withdrawal",
        target_id=str(withdrawal.id),
        detail={
            "user_id": withdrawal.user_id,
            "points_refunded": withdrawal.points,
            "amount_soles": str(withdrawal.amount_soles),
        },
        note=body.note,
    )
    # 返還・ステータス更新・履歴を1トランザクションにまとめる。
    # 片方だけ確定すると、ポイントが戻らないまま却下済みになる
    invalidate_stats_cache()
    session.commit()
    session.refresh(withdrawal)
    logger.info("withdrawal rejected: id=%s by admin=%s", withdrawal.id, admin.id)
    return AdminWithdrawalRead.model_validate(
        {**withdrawal.model_dump(), "user_email": None}
    )


# ---------------------------------------------------------------- 成果・案件

@router.get("/postbacks", response_model=AdminPostbackList)
def list_postbacks(
    status: Optional[str] = None,
    provider: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=PER_PAGE_MAX),
    session: Session = Depends(get_session),
):
    stmt = select(Postback)
    status = _valid(status, POSTBACK_STATUSES)
    provider = _valid(provider, PROVIDERS)
    if status:
        stmt = stmt.where(Postback.status == status)
    if provider:
        stmt = stmt.where(Postback.provider == provider)
    stmt = stmt.order_by(Postback.created_at.desc())
    rows, meta = _paginate(session, stmt, page, per_page)
    emails = _emails(session, [r.user_id for r in rows])
    return AdminPostbackList(
        postbacks=[
            AdminPostbackRead.model_validate({**r.model_dump(), "user_email": emails.get(r.user_id)})
            for r in rows
        ],
        page=meta,
    )


@router.get("/offers", response_model=OfferList)
def list_offers(admin: User = Depends(require_admin)):
    """CPALeadから取得した案件一覧（参照のみ）。表示確認用にsubidは管理者自身のIDを使う"""
    try:
        offers = CPALeadService.fetch_offers(str(admin.id))
    except CPALeadError as exc:
        raise ApiError(502, exc.code, exc.message)
    return OfferList(offers=[OfferRead(**o) for o in offers])


@router.get("/postback-logs", response_model=AdminPostbackLogList)
def list_postback_logs(
    verified: Optional[bool] = None,
    provider: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=PER_PAGE_MAX),
    session: Session = Depends(get_session),
):
    stmt = select(PostbackLog)
    provider = _valid(provider, PROVIDERS)
    if verified is not None:
        stmt = stmt.where(PostbackLog.verified == verified)
    if provider:
        stmt = stmt.where(PostbackLog.provider == provider)
    stmt = stmt.order_by(PostbackLog.received_at.desc())
    rows, meta = _paginate(session, stmt, page, per_page)
    return AdminPostbackLogList(
        logs=[AdminPostbackLogRead.model_validate(r, from_attributes=True) for r in rows], page=meta
    )


# ---------------------------------------------------------------- チャージ・苦情

@router.get("/topups", response_model=AdminTopUpList)
def list_topups(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=PER_PAGE_MAX),
    session: Session = Depends(get_session),
):
    stmt = select(TopUp)
    status = _valid(status, TOPUP_STATUSES)
    if status:
        stmt = stmt.where(TopUp.status == status)
    stmt = stmt.order_by(TopUp.created_at.desc())
    rows, meta = _paginate(session, stmt, page, per_page)
    emails = _emails(session, [r.user_id for r in rows])
    return AdminTopUpList(
        topups=[
            AdminTopUpRead.model_validate({**r.model_dump(), "user_email": emails.get(r.user_id)})
            for r in rows
        ],
        page=meta,
    )


@router.get("/complaints", response_model=AdminComplaintList)
def list_complaints(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=PER_PAGE_MAX),
    session: Session = Depends(get_session),
):
    stmt = select(Complaint)
    status = _valid(status, COMPLAINT_STATUSES)
    if status:
        stmt = stmt.where(Complaint.status == status)
    stmt = stmt.order_by(Complaint.created_at.desc())
    rows, meta = _paginate(session, stmt, page, per_page)
    return AdminComplaintList(
        complaints=[AdminComplaintRead.model_validate(r, from_attributes=True) for r in rows], page=meta
    )


@router.post("/complaints/{complaint_id}/respond", response_model=AdminComplaintRead)
def respond_complaint(
    complaint_id: UUID,
    body: WithdrawalActionBody,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """苦情記録簿を対応済みにする。Indecopiの規定で応答義務があるため記録を残す"""
    complaint = session.get(Complaint, complaint_id)
    if complaint is None:
        raise ApiError(404, "COMPLAINT_NOT_FOUND", "Reclamo no encontrado")
    if complaint.status == "respondido":
        raise ApiError(409, "ALREADY_PROCESSED", "Este reclamo ya fue respondido")

    complaint.status = "respondido"
    admin_service.log_action(
        session,
        admin=admin,
        action="complaint.respond",
        target_type="complaint",
        target_id=str(complaint.id),
        detail={"number": complaint.number, "tipo": complaint.tipo},
        note=body.note,
    )
    invalidate_stats_cache()
    session.commit()
    session.refresh(complaint)
    return AdminComplaintRead.model_validate(complaint, from_attributes=True)


# ---------------------------------------------------------------- 操作履歴

@router.get("/logs", response_model=AdminLogList)
def list_admin_logs(
    action: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=PER_PAGE_MAX),
    session: Session = Depends(get_session),
):
    stmt = select(AdminLog)
    if action:
        stmt = stmt.where(AdminLog.action == action)
    stmt = stmt.order_by(AdminLog.created_at.desc())
    rows, meta = _paginate(session, stmt, page, per_page)
    emails = _emails(session, [r.admin_user_id for r in rows])
    return AdminLogList(
        logs=[
            AdminLogRead.model_validate({**r.model_dump(), "admin_email": emails.get(r.admin_user_id)})
            for r in rows
        ],
        page=meta,
    )
