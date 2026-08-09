"""記事に紐づく画像の後始末。

画像はペースト時に即アップロードするため、本文から消されたものが
そのままAppwriteに残り続ける。参照されなくなった時点で消す。

⚠️ 削除する前に必ず「他の記事から参照されていないか」を確認する。
   記事間で画像URLをコピペした場合、片方の保存でもう片方の画像が
   消えると復旧できない
"""
import logging
import re
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

import config
from models import Post
from services.appwrite_storage import AppwriteStorageService

logger = logging.getLogger("post_images")

# 本文中の ![](URL) や <img src="URL"> から、自分のバケットのURLだけを拾う
_URL_PATTERN = re.compile(r'https?://[^\s"\'\)<>]+/files/([A-Za-z0-9_-]+)/view[^\s"\'\)<>]*')

# アップロードしてから編集中の画像を巻き込まないための猶予
ORPHAN_GRACE = timedelta(hours=24)


def extract_file_ids(*texts: str | None) -> set[str]:
    """本文やカバー画像のURLからAppwriteのfile_idを取り出す"""
    found: set[str] = set()
    for text in texts:
        if not text:
            continue
        for match in _URL_PATTERN.finditer(text):
            found.add(match.group(1))
    return found


def referenced_file_ids(session: Session, exclude_post_id=None) -> set[str]:
    """全記事が参照しているfile_idの集合"""
    stmt = select(Post)
    if exclude_post_id is not None:
        stmt = stmt.where(Post.id != exclude_post_id)
    ids: set[str] = set()
    for post in session.exec(stmt).all():
        ids |= extract_file_ids(post.body, post.image_url)
    return ids


def cleanup_removed(session: Session, *, post_id, before: set[str], after: set[str]) -> int:
    """記事の保存で参照が外れた画像を削除する。削除した枚数を返す"""
    removed = before - after
    if not removed:
        return 0

    # 他の記事がまだ使っているものは残す
    still_used = referenced_file_ids(session, exclude_post_id=post_id)
    deletable = removed - still_used

    count = 0
    for file_id in deletable:
        if AppwriteStorageService.delete(file_id):
            count += 1
    if count:
        logger.info("deleted %s unreferenced image(s) for post=%s", count, post_id)
    return count


def cleanup_orphans(session: Session) -> dict:
    """バケット内の未参照ファイルを掃除する。

    「ペーストしたが保存せずに離脱した」画像を拾うための手動実行用。
    編集中のものを消さないよう、アップロードから24時間経ったものだけを対象にする
    """
    storage = AppwriteStorageService.list_files()
    referenced = referenced_file_ids(session)
    cutoff = datetime.now(timezone.utc) - ORPHAN_GRACE

    deleted, kept = 0, 0
    for f in storage:
        file_id = f.get("$id")
        if not file_id or file_id in referenced:
            kept += 1
            continue

        created = f.get("$createdAt")
        if created:
            try:
                # AppwriteはISO8601で返す
                if datetime.fromisoformat(created.replace("Z", "+00:00")) > cutoff:
                    kept += 1
                    continue
            except ValueError:
                pass

        if AppwriteStorageService.delete(file_id):
            deleted += 1

    logger.info("orphan cleanup: deleted=%s kept=%s bucket=%s", deleted, kept, config.APPWRITE_BUCKET_ID)
    return {"deleted": deleted, "kept": kept}
