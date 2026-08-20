"""ログイン手段（provider）ごとのユーザー解決。

ログイン手段が増えても、ユーザーの作成・紐づけの規則を1箇所に保つためにここへ集める。

## 同じ人を1アカウントに保つ

`(provider, provider_user_id)` で見つからなくても、**同じメールの既存ユーザーがいれば
そちらに紐づける**。別々に作ると、

- 同じ人が2アカウント持ち、キャンペーンの枠を二重に消費する
- ポイントが分かれて「消えた」と見える

の2つが起きる。メールはプロバイダをまたいだ同一性の判断材料として使う。

⚠️ メールの所有確認が済んでいる手段だけをここに通すこと。GoogleのIDトークンは
   検証済みのメールを返す。未確認のメールを信じると、他人のメールを名乗るだけで
   既存アカウントを乗っ取れる。
"""
import logging
from typing import Optional

from sqlmodel import Session, select

from models import User
from services import campaign_service

logger = logging.getLogger(__name__)

PROVIDER_GOOGLE = "google"
PROVIDER_FACEBOOK = "facebook"
PROVIDER_EMAIL = "email"


def resolve_user(
    session: Session,
    *,
    provider: str,
    provider_user_id: str,
    email: str,
    name: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> User:
    """ログイン情報からユーザーを返す。居なければ作る。

    新規作成のときだけキャンペーン報酬を付ける。commitは呼び出し元で行う。
    """
    user = session.exec(
        select(User).where(
            User.provider == provider, User.provider_user_id == provider_user_id
        )
    ).first()

    if user is not None:
        # 表示情報は毎回追従させる（改名やアイコン変更に追いつくため）
        user.name = name or user.name
        user.avatar_url = avatar_url or user.avatar_url
        return user

    # 同じメールの既存ユーザーがいれば、新規に作らずそちらへ紐づける
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing is not None:
        logger.info(
            "linked existing account by email: user=%s from=%s to=%s",
            existing.id,
            existing.provider,
            provider,
        )
        return existing

    user = User(
        provider=provider,
        provider_user_id=provider_user_id,
        email=email,
        name=name,
        avatar_url=avatar_url,
    )
    session.add(user)
    # idを確定させてから枠を確保する（ログに残すidが要るため）
    session.flush()
    # ⚠️ ここでは**枠を確保するだけ**。ポイントは渡さない。
    #    登録だけで付与すると、メールアドレスを大量に作るだけで盗めるものが
    #    生まれる（マジックリンクがあるので電話番号もGoogleアカウントも不要）。
    #    付与は電話番号を登録したとき（routers/phone.py）
    campaign_service.reserve_slot(session, user)
    return user
