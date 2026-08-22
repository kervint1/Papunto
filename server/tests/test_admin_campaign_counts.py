"""管理画面とユーザー側で、枠の数え方を揃える。

本番で利用者に99と出ているのに管理画面が97になっていた。
管理画面が slot_limit - users_total で計算しており、users_total には
管理者と除外済みが含まれていたため。数え方は campaign_service に寄せる。
"""
from sqlmodel import Session

from models import User
from services import campaign_service
from services.auth_service import AuthService


def auth(user: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(user.id)}"}


def make(session: Session, email: str, uid: str, **kw) -> User:
    u = User(provider_user_id=uid, email=email, **kw)
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


def test_管理画面の残り枠が利用者向けと一致する(client, session: Session, user: User):
    admin = make(session, "admin@example.com", "g-admin", is_admin=True)
    campaign_service.reserve_slot(session, user)
    session.commit()

    publico = client.get("/api/v1/campaign/status").json()["remaining"]
    privado = client.get("/api/v1/admin/campaign-settings", headers=auth(admin)).json()

    assert privado["remaining"] == publico
    # 管理者は枠を取らないので、全ユーザー数とは一致しない
    assert privado["users_total"] > privado["reserved_count"]


def test_退会した人は枠にも報酬の集計にも数えない(client, session: Session, user: User):
    from tests.conftest import complete_registration

    admin = make(session, "admin@example.com", "g-admin", is_admin=True)
    complete_registration(session, user)
    antes = client.get("/api/v1/admin/campaign-settings", headers=auth(admin)).json()
    assert antes["granted_count"] == 1

    client.delete("/api/v1/me", headers=auth(user))

    despues = client.get("/api/v1/admin/campaign-settings", headers=auth(admin)).json()
    assert despues["granted_count"] == 0
    assert despues["remaining"] == antes["remaining"] + 1


def test_対象者だけを絞り込める(client, session: Session, user: User):
    from tests.conftest import complete_registration

    admin = make(session, "admin@example.com", "g-admin", is_admin=True)
    complete_registration(session, user)
    # 枠はあるが電話番号を入れていない人
    sin_celular = make(session, "sin@example.com", "g-sin")
    campaign_service.reserve_slot(session, sin_celular)
    session.commit()

    def ids(campaign: str) -> set[int]:
        res = client.get(f"/api/v1/admin/users?campaign={campaign}", headers=auth(admin))
        return {u["id"] for u in res.json()["users"]}

    assert ids("reserved") == {user.id, sin_celular.id}
    assert ids("granted") == {user.id}
    assert ids("pending") == {sin_celular.id}
    # 管理者は枠を取らないのでどこにも出ない
    assert admin.id not in ids("reserved")
