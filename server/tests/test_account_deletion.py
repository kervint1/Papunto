"""退会（アカウント削除）と管理者権限の付け外し。

守りたいのは3つ。

1. **会計が壊れないこと。** 物理削除しないので、台帳の不変条件
   `sum(point_transactions) == users.points` が保たれる
2. **UNIQUE制約が空くこと。** 空けないとその人は二度と登録できない
3. **退会 → 再登録で300ptを二度取りできないこと。** 電話番号は
   キャンペーンの不正対策の土台なので、番号を消しても事実は残す
"""
import pytest
from sqlmodel import Session, func, select

from models import PointTransaction, User, Withdrawal
from services import account_service, campaign_service
from services.auth_service import AuthService
from tests.conftest import complete_registration


def auth(user: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(user.id)}"}


def make_user(session: Session, *, email: str, provider_user_id: str, is_admin: bool = False) -> User:
    u = User(provider_user_id=provider_user_id, email=email, is_admin=is_admin)
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


# ------------------------------------------------------------------ 退会

def test_退会すると個人が特定できる値が消える(client, session: Session, user: User):
    complete_registration(session, user)
    user.name = "Nombre Real"
    user.avatar_url = "https://example.com/a.png"
    session.add(user)
    session.commit()

    assert client.delete("/api/v1/me", headers=auth(user)).status_code == 204

    session.refresh(user)
    assert user.deleted_at is not None
    assert user.name is None
    assert user.avatar_url is None
    assert user.phone is None
    assert "test@example.com" not in user.email


def test_行は消さない(client, session: Session, user: User):
    """台帳・成果・換金が user_id で刺さっているので、消すと会計が壊れる"""
    complete_registration(session, user)
    user_id = user.id

    client.delete("/api/v1/me", headers=auth(user))

    assert session.get(User, user_id) is not None


def test_残ったポイントは台帳に書いてから失効させる(client, session: Session, user: User):
    """残高だけ0にすると sum(point_transactions) == users.points が壊れる"""
    complete_registration(session, user)
    assert user.points == 300

    client.delete("/api/v1/me", headers=auth(user))

    session.refresh(user)
    assert user.points == 0
    total = session.exec(
        select(func.coalesce(func.sum(PointTransaction.points), 0)).where(
            PointTransaction.user_id == user.id
        )
    ).one()
    assert int(total) == 0


def test_UNIQUE制約が空いて再登録できる(client, session: Session, user: User):
    """空けないとその人は二度と登録できない"""
    complete_registration(session, user)
    old_email = user.email
    client.delete("/api/v1/me", headers=auth(user))
    session.refresh(user)

    # 同じメールで新しい行を作れる
    again = User(provider_user_id="google-test-1", email=old_email)
    session.add(again)
    session.commit()
    assert again.id != user.id


def test_退会後はトークンが通らない(client, session: Session, user: User):
    """自前JWTは7日有効なので、弾かないと退会後もAPIを叩ける"""
    headers = auth(user)
    assert client.delete("/api/v1/me", headers=headers).status_code == 204

    res = client.get("/api/v1/me", headers=headers)

    assert res.status_code == 401
    assert res.json()["error"]["code"] == "ACCOUNT_DELETED"


def test_換金の申請中は退会させない(client, session: Session, user: User):
    """申請時点でポイントを引いてあるので、消すと送るべき額の記録が宙に浮く"""
    complete_registration(session, user)
    session.add(
        Withdrawal(user_id=user.id, yape_phone="987654321", points=500, amount_soles=5, status="pending")
    )
    session.commit()

    res = client.delete("/api/v1/me", headers=auth(user))

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "WITHDRAWAL_PENDING"


def test_二重に退会させない(client, session: Session, user: User):
    headers = auth(user)
    client.delete("/api/v1/me", headers=headers)
    # トークンが無効になるので、サービスを直接呼んで確認する
    from errors import ApiError

    with pytest.raises(ApiError) as e:
        account_service.delete_account(session, user)
    assert e.value.code == "ALREADY_DELETED"


# ------------------------------------------------ 退会したあとの再登録

def test_同じ番号で再登録しても300ptを二度は渡さない(client, session: Session, user: User):
    """退会で番号は消えるが、ハッシュだけ残して受給済みだと分かるようにしている"""
    complete_registration(session, user, phone="987654321")
    client.delete("/api/v1/me", headers=auth(user))
    session.refresh(user)
    assert user.phone_hash is not None

    nuevo = make_user(session, email="nuevo@example.com", provider_user_id="google-2")
    campaign_service.reserve_slot(session, nuevo)
    nuevo.phone = "987654321"
    session.add(nuevo)
    session.flush()

    granted = campaign_service.grant_reward(session, nuevo)

    assert granted is False
    assert nuevo.points == 0


def test_別の番号なら再登録で受け取れる(client, session: Session, user: User):
    """締め出すのは同じ番号だけ。実際に別のSIMを用意したなら正当な新規"""
    complete_registration(session, user, phone="987654321")
    client.delete("/api/v1/me", headers=auth(user))

    nuevo = make_user(session, email="nuevo@example.com", provider_user_id="google-2")
    campaign_service.reserve_slot(session, nuevo)
    nuevo.phone = "912345678"
    session.add(nuevo)
    session.flush()

    assert campaign_service.grant_reward(session, nuevo) is True
    assert nuevo.points == 300


def test_番号のハッシュから番号は復元できない(session: Session):
    """9桁固定で探索空間が1億しかないので、素のsha256にしない"""
    import hashlib

    phone = "987654321"
    assert account_service.hash_phone(phone) != hashlib.sha256(phone.encode()).hexdigest()


# --------------------------------------------------------- 管理者権限

def test_管理者権限を付けられる(client, session: Session):
    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)
    target = make_user(session, email="otro@example.com", provider_user_id="g-otro")

    res = client.post(
        f"/api/v1/admin/users/{target.id}/admin", json={"is_admin": True}, headers=auth(admin)
    )

    assert res.status_code == 200
    session.refresh(target)
    assert target.is_admin is True


def test_管理者権限を外せる(client, session: Session):
    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)
    target = make_user(session, email="otro@example.com", provider_user_id="g-otro", is_admin=True)

    client.post(
        f"/api/v1/admin/users/{target.id}/admin", json={"is_admin": False}, headers=auth(admin)
    )

    session.refresh(target)
    assert target.is_admin is False


def test_自分自身は変更できない(client, session: Session):
    """降格して管理者が0人になると、DBを直接触るまで誰も入れなくなる"""
    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)

    res = client.post(
        f"/api/v1/admin/users/{admin.id}/admin", json={"is_admin": False}, headers=auth(admin)
    )

    assert res.status_code == 400
    assert res.json()["error"]["code"] == "CANNOT_MODIFY_SELF"
    session.refresh(admin)
    assert admin.is_admin is True


def test_管理者以外は変更できない(client, session: Session):
    normal = make_user(session, email="normal@example.com", provider_user_id="g-normal")
    target = make_user(session, email="otro@example.com", provider_user_id="g-otro")

    res = client.post(
        f"/api/v1/admin/users/{target.id}/admin", json={"is_admin": True}, headers=auth(normal)
    )

    assert res.status_code == 403


def test_権限の変更は監査ログに残る(client, session: Session):
    """DBから直接UPDATEする運用をやめた以上、記録が最低条件"""
    from models import AdminLog

    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)
    target = make_user(session, email="otro@example.com", provider_user_id="g-otro")

    client.post(
        f"/api/v1/admin/users/{target.id}/admin", json={"is_admin": True}, headers=auth(admin)
    )

    log = session.exec(select(AdminLog).where(AdminLog.action == "user.set_admin")).first()
    assert log is not None
    assert log.detail["before"] is False
    assert log.detail["after"] is True


def test_退会したユーザーは管理者にできない(client, session: Session, user: User):
    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)
    client.delete("/api/v1/me", headers=auth(user))

    res = client.post(
        f"/api/v1/admin/users/{user.id}/admin", json={"is_admin": True}, headers=auth(admin)
    )

    assert res.status_code == 409


# ------------------------------------------------------------- 凍結

def test_凍結すると全APIが使えなくなる(client, session: Session, user: User):
    """規約9条の「停止」の実体。campaign_excluded では
    アカウント自体は使い続けられる"""
    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)

    res = client.post(
        f"/api/v1/admin/users/{user.id}/suspension",
        json={"suspended": True, "reason": "fraude"},
        headers=auth(admin),
    )
    assert res.status_code == 200

    me = client.get("/api/v1/me", headers=auth(user))
    assert me.status_code == 403
    assert me.json()["error"]["code"] == "ACCOUNT_SUSPENDED"


def test_凍結を解除すると使えるようになる(client, session: Session, user: User):
    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)
    client.post(
        f"/api/v1/admin/users/{user.id}/suspension",
        json={"suspended": True},
        headers=auth(admin),
    )

    client.post(
        f"/api/v1/admin/users/{user.id}/suspension",
        json={"suspended": False},
        headers=auth(admin),
    )

    assert client.get("/api/v1/me", headers=auth(user)).status_code == 200


def test_凍結中はログインさせない(client, session: Session, user: User, monkeypatch):
    """トークンを出すと毎回403になり、利用者からは
    「入れるのに何も動かない」に見える"""
    import config

    monkeypatch.setattr(config, "MAGIC_LINK_DEV_ECHO", True)
    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)
    client.post(
        f"/api/v1/admin/users/{user.id}/suspension",
        json={"suspended": True},
        headers=auth(admin),
    )

    # マジックリンクを発行して踏む＝ログインと同じ経路
    from services import magic_link_service

    raw = magic_link_service.issue(session, user.email)
    session.commit()
    res = client.post("/api/v1/auth/magic-link/verify", json={"token": raw})

    assert res.status_code == 403
    assert res.json()["error"]["code"] == "ACCOUNT_SUSPENDED"


def test_自分は凍結できない(client, session: Session):
    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)

    res = client.post(
        f"/api/v1/admin/users/{admin.id}/suspension",
        json={"suspended": True},
        headers=auth(admin),
    )

    assert res.status_code == 400


# ------------------------------------------------- 管理者による削除

def test_管理者がアカウントを削除できる(client, session: Session, user: User):
    """本人がメールにアクセスできなくなった場合の削除請求に応えるため"""
    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)
    complete_registration(session, user)

    res = client.delete(f"/api/v1/admin/users/{user.id}", headers=auth(admin))

    assert res.status_code == 204
    session.refresh(user)
    assert user.deleted_at is not None
    assert user.phone is None


def test_管理者の削除も監査ログに残る(client, session: Session, user: User):
    from models import AdminLog

    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)
    client.delete(f"/api/v1/admin/users/{user.id}", headers=auth(admin))

    log = session.exec(select(AdminLog).where(AdminLog.action == "user.delete")).first()
    assert log is not None
    assert log.detail["email"] == "test@example.com"


def test_換金の申請中は管理者でも削除できない(client, session: Session, user: User):
    """先に却下してポイントを返してから削除する"""
    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)
    complete_registration(session, user)
    session.add(
        Withdrawal(user_id=user.id, yape_phone="987654321", points=500, amount_soles=5, status="pending")
    )
    session.commit()

    res = client.delete(f"/api/v1/admin/users/{user.id}", headers=auth(admin))

    assert res.status_code == 409


def test_自分は管理画面から削除できない(client, session: Session):
    admin = make_user(session, email="admin@example.com", provider_user_id="g-admin", is_admin=True)

    res = client.delete(f"/api/v1/admin/users/{admin.id}", headers=auth(admin))

    assert res.status_code == 400


def test_退会済みのアドレスにはメールを送らない(monkeypatch):
    """送るとバウンスが積もり、送信ドメインの評価が落ちる"""
    import config
    from services import mail_service

    monkeypatch.setattr(config, "SMTP_HOST", "smtp.example.com")
    monkeypatch.setattr(config, "SMTP_USER", "u")
    monkeypatch.setattr(config, "SMTP_PASSWORD", "p")

    def boom(*a, **k):
        raise AssertionError("SMTPに接続してはいけない")

    monkeypatch.setattr("smtplib.SMTP", boom)

    # 例外が出なければ、接続せずに戻っている
    mail_service.send(to="deleted+3@deleted.invalid", subject="x", body="y")
