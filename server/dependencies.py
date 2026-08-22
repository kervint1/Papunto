from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from database import get_session
from errors import ApiError
from models import User
from services.auth_service import AuthService

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> User:
    if credentials is None:
        raise ApiError(401, "UNAUTHORIZED", "Inicia sesión para continuar")
    payload = AuthService.verify_token(credentials.credentials)
    if payload is None:
        raise ApiError(401, "INVALID_TOKEN", "Sesión inválida o expirada")
    user = session.get(User, int(payload["sub"]))
    if user is None:
        raise ApiError(401, "USER_NOT_FOUND", "Usuario no encontrado")
    # ⚠️ 自前JWTは7日有効なので、退会してもトークンは生きたまま残る。
    #    ここで弾かないと、退会後もAPIを叩き続けられる
    if user.deleted_at is not None:
        raise ApiError(401, "ACCOUNT_DELETED", "Esta cuenta fue eliminada")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """管理APIの入口。管理者以外は403で弾く。

    フロント側でも/admin配下を隠すが、それは表示上の都合にすぎない。権限判定はここが正
    """
    if not user.is_admin:
        raise ApiError(403, "FORBIDDEN", "No tienes permiso para acceder")
    return user
