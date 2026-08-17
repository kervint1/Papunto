"""電話番号が登録済みであることを要求する依存関係。

ログイン自体には電話番号を求めない（先に求めると詐欺と思われて離脱する）。
タスクの実行と換金の手前で初めて求める、という方針のためのゲート。

フロントは `PHONE_REQUIRED` を見て登録画面へ誘導する。
"""
from fastapi import Depends

from dependencies import get_current_user
from errors import ApiError
from models import User

PHONE_REQUIRED = "PHONE_REQUIRED"


def require_phone(user: User = Depends(get_current_user)) -> User:
    if not user.phone:
        raise ApiError(
            403,
            PHONE_REQUIRED,
            "Registra tu número de Yape para continuar",
        )
    return user
