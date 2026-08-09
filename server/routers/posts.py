"""メディアサイト（pandia）の記事API。

- 公開用 `/api/v1/posts` … 認証なし。公開済みのみ返す
- 管理用 `/api/v1/admin/posts` … require_admin。下書きを含む全操作

記事はユーザー系のテーブルと繋がっていないため、このファイルとmodels/post.py、
schemas/post.py を移せばメディアだけ切り出せる。
"""
import logging
import re
import unicodedata
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlmodel import Session, select

from database import get_session
from dependencies import require_admin
from errors import ApiError
from models import Post, User
from models.post import POST_STATUSES, STATUS_DRAFT, STATUS_PUBLISHED
from schemas.admin import Page
from schemas.post import (
    PostCreate,
    PostList,
    PostRead,
    PostSummary,
    PostUpdate,
    PublicPostList,
    PublicPostRead,
)
from routers.admin import invalidate_stats_cache
from services import admin_service, post_images

logger = logging.getLogger("posts")

public_router = APIRouter(prefix="/api/v1/posts", tags=["posts"])
admin_router = APIRouter(
    prefix="/api/v1/admin/posts", tags=["admin-posts"], dependencies=[Depends(require_admin)]
)

PER_PAGE_MAX = 100


def slugify(value: str) -> str:
    """タイトルからURL用のスラッグを作る。

    スペイン語のアクセント付き文字（á, ñ 等）をASCIIに落としてから整形する。
    そのまま使うとURLがパーセントエンコードされて読めなくなるため
    """
    normalized = unicodedata.normalize("NFKD", value)
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_only).strip("-").lower()
    return slug[:80] or "post"


def unique_slug(session: Session, base: str, exclude_id: Optional[UUID] = None) -> str:
    """重複したら -2, -3 と連番を足す"""
    candidate = base
    n = 1
    while True:
        stmt = select(Post).where(Post.slug == candidate)
        if exclude_id is not None:
            stmt = stmt.where(Post.id != exclude_id)
        if session.exec(stmt).first() is None:
            return candidate
        n += 1
        candidate = f"{base}-{n}"


# ---------------------------------------------------------------- 公開用

@public_router.get("", response_model=PublicPostList)
def list_public_posts(session: Session = Depends(get_session)):
    """公開済みの記事を新しい順で返す。本文は含めない"""
    rows = session.exec(
        select(Post)
        .where(Post.status == STATUS_PUBLISHED)
        .order_by(Post.published_at.desc())
    ).all()
    return PublicPostList(posts=[PostSummary.model_validate(r.to_public()) for r in rows])


@public_router.get("/{slug}", response_model=PublicPostRead)
def get_public_post(slug: str, session: Session = Depends(get_session)):
    post = session.exec(
        select(Post).where(Post.slug == slug, Post.status == STATUS_PUBLISHED)
    ).first()
    if post is None:
        # 下書きの存在を漏らさないため、非公開も未存在も同じ404にする
        raise ApiError(404, "POST_NOT_FOUND", "Artículo no encontrado")
    return PublicPostRead.model_validate(post.to_public())


# ---------------------------------------------------------------- 管理用

@admin_router.get("", response_model=PostList)
def list_posts(
    status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=PER_PAGE_MAX),
    session: Session = Depends(get_session),
):
    stmt = select(Post)
    if status in POST_STATUSES:
        stmt = stmt.where(Post.status == status)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(Post.title.ilike(like) | Post.slug.ilike(like))
    stmt = stmt.order_by(Post.updated_at.desc())

    total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    rows = session.exec(stmt.offset((page - 1) * per_page).limit(per_page)).all()

    return PostList(
        posts=[PostRead.model_validate(r, from_attributes=True) for r in rows],
        page=Page(page=page, per_page=per_page, total=total),
    )


@admin_router.get("/{post_id}", response_model=PostRead)
def get_post(post_id: UUID, session: Session = Depends(get_session)):
    post = session.get(Post, post_id)
    if post is None:
        raise ApiError(404, "POST_NOT_FOUND", "Artículo no encontrado")
    return PostRead.model_validate(post, from_attributes=True)


@admin_router.post("", response_model=PostRead, status_code=201)
def create_post(body: PostCreate, session: Session = Depends(get_session)):
    """常に下書きとして作る。AIから投稿する場合もここを使う（公開は人が押す）"""
    if not body.title.strip():
        raise ApiError(422, "INVALID_TITLE", "El título es obligatorio")

    base = slugify(body.slug or body.title)
    post = Post(
        slug=unique_slug(session, base),
        title=body.title,
        description=body.description,
        body=body.body,
        tags=body.tags,
        image_url=body.image_url,
        author=body.author,
        status=STATUS_DRAFT,
    )
    session.add(post)
    session.commit()
    session.refresh(post)
    return PostRead.model_validate(post, from_attributes=True)


@admin_router.patch("/{post_id}", response_model=PostRead)
def update_post(post_id: UUID, body: PostUpdate, session: Session = Depends(get_session)):
    post = session.get(Post, post_id)
    if post is None:
        raise ApiError(404, "POST_NOT_FOUND", "Artículo no encontrado")

    # 保存前後で本文・カバー画像から参照が外れた画像を後で消すため、先に控えておく
    before = post_images.extract_file_ids(post.body, post.image_url)

    data = body.model_dump(exclude_unset=True)
    if "slug" in data and data["slug"]:
        # 公開後にslugを変えるとURLが変わり、それまでの検索評価を失う
        if post.status == STATUS_PUBLISHED and slugify(data["slug"]) != post.slug:
            raise ApiError(
                409, "SLUG_LOCKED", "No se puede cambiar la URL de un artículo publicado"
            )
        data["slug"] = unique_slug(session, slugify(data["slug"]), exclude_id=post.id)

    for key, value in data.items():
        setattr(post, key, value)
    post.updated_at = datetime.now(timezone.utc)

    session.add(post)
    session.commit()
    session.refresh(post)

    # 参照が外れた画像を掃除する。Appwrite未設定や通信失敗で記事の保存を
    # 巻き戻したくないので、commit後に行い失敗しても握りつぶす
    try:
        post_images.cleanup_removed(
            session,
            post_id=post.id,
            before=before,
            after=post_images.extract_file_ids(post.body, post.image_url),
        )
    except Exception as exc:
        logger.warning("image cleanup skipped: %s", exc)

    return PostRead.model_validate(post, from_attributes=True)


@admin_router.post("/{post_id}/publish", response_model=PostRead)
def publish_post(
    post_id: UUID,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    post = session.get(Post, post_id)
    if post is None:
        raise ApiError(404, "POST_NOT_FOUND", "Artículo no encontrado")
    if not post.title.strip() or not post.body.strip():
        raise ApiError(422, "INCOMPLETE_POST", "Falta el título o el contenido")

    post.status = STATUS_PUBLISHED
    # 初回公開時のみ日付を打つ。再公開で上書きすると新しい記事として扱われてしまう
    if post.published_at is None:
        post.published_at = datetime.now(timezone.utc)
    post.updated_at = datetime.now(timezone.utc)

    admin_service.log_action(
        session,
        admin=admin,
        action="post.publish",
        target_type="post",
        target_id=str(post.id),
        detail={"slug": post.slug, "title": post.title},
    )
    invalidate_stats_cache()
    session.commit()
    session.refresh(post)
    logger.info("post published: slug=%s by admin=%s", post.slug, admin.id)
    return PostRead.model_validate(post, from_attributes=True)


@admin_router.post("/{post_id}/unpublish", response_model=PostRead)
def unpublish_post(
    post_id: UUID,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    post = session.get(Post, post_id)
    if post is None:
        raise ApiError(404, "POST_NOT_FOUND", "Artículo no encontrado")

    post.status = STATUS_DRAFT
    post.updated_at = datetime.now(timezone.utc)
    admin_service.log_action(
        session,
        admin=admin,
        action="post.unpublish",
        target_type="post",
        target_id=str(post.id),
        detail={"slug": post.slug, "title": post.title},
    )
    invalidate_stats_cache()
    session.commit()
    session.refresh(post)
    return PostRead.model_validate(post, from_attributes=True)


@admin_router.delete("/{post_id}", status_code=204)
def delete_post(
    post_id: UUID,
    admin: User = Depends(require_admin),
    session: Session = Depends(get_session),
):
    post = session.get(Post, post_id)
    if post is None:
        raise ApiError(404, "POST_NOT_FOUND", "Artículo no encontrado")
    if post.status == STATUS_PUBLISHED:
        # 公開中の記事をいきなり消すと404が量産される。先に非公開にさせる
        raise ApiError(409, "PUBLISHED_POST", "Despublica el artículo antes de eliminarlo")

    admin_service.log_action(
        session,
        admin=admin,
        action="post.delete",
        target_type="post",
        target_id=str(post.id),
        detail={"slug": post.slug, "title": post.title},
    )
    used = post_images.extract_file_ids(post.body, post.image_url)

    invalidate_stats_cache()
    session.delete(post)
    session.commit()

    # 記事ごと消えたので、その記事だけが使っていた画像も消す
    try:
        post_images.cleanup_removed(session, post_id=post.id, before=used, after=set())
    except Exception as exc:
        logger.warning("image cleanup skipped: %s", exc)
