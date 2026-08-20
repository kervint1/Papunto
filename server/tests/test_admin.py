"""管理APIの検証。

お金が動く経路（換金の承認・却下とポイント返還）と、認可が外れていないことに絞る。
"""
import uuid
from decimal import Decimal

import pytest
from sqlmodel import Session, select

from models import AdminLog, Complaint, User, Withdrawal
from services.auth_service import AuthService
from tests.conftest import complete_registration, earn_from_task


@pytest.fixture(name="admin")
def admin_fixture(session: Session):
    user = User(provider_user_id="g-admin", email="admin@example.com", name="Admin", points=0, is_admin=True)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def auth(u: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(u.id)}"}


def make_withdrawal(session: Session, user: User, points: int = 500) -> Withdrawal:
    """申請と同じ状態を作る。ポイントは申請時点で差し引かれている"""
    user.points -= points
    w = Withdrawal(
        user_id=user.id,
        yape_phone="987654321",
        points=points,
        amount_soles=Decimal(points // 100),
    )
    session.add(w)
    session.commit()
    session.refresh(w)
    return w


def points_of(session: Session, user_id: int) -> int:
    session.expire_all()
    return session.exec(select(User).where(User.id == user_id)).one().points


# ---------------------------------------------------------------- 認可

ENDPOINTS = [
    "/api/v1/admin/stats",
    "/api/v1/admin/users",
    "/api/v1/admin/withdrawals",
    "/api/v1/admin/postbacks",
    "/api/v1/admin/postback-logs",
    "/api/v1/admin/topups",
    "/api/v1/admin/complaints",
    "/api/v1/admin/logs",
]


@pytest.mark.parametrize("path", ENDPOINTS)
def test_requires_authentication(client, path):
    assert client.get(path).status_code == 401


@pytest.mark.parametrize("path", ENDPOINTS)
def test_non_admin_is_forbidden(client, user, path):
    """一般ユーザーはトークンが正しくても入れないこと"""
    res = client.get(path, headers=auth(user))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"


@pytest.mark.parametrize("path", ENDPOINTS)
def test_admin_can_access(client, admin, path):
    assert client.get(path, headers=auth(admin)).status_code == 200


def test_non_admin_cannot_act_on_withdrawal(client, session, user, admin):
    """参照だけでなく更新系も塞がっていること"""
    w = make_withdrawal(session, admin, 500)
    res = client.post(f"/api/v1/admin/withdrawals/{w.id}/approve", json={}, headers=auth(user))
    assert res.status_code == 403
    session.expire_all()
    assert session.get(Withdrawal, w.id).status == "pending"


# ---------------------------------------------------------------- 換金の承認

def test_approve_marks_completed_without_touching_points(client, session, admin):
    """承認してもポイントは動かない（申請時に差し引き済みのため）"""
    admin.points = 1000
    session.commit()
    w = make_withdrawal(session, admin, 500)
    assert points_of(session, admin.id) == 500

    res = client.post(
        f"/api/v1/admin/withdrawals/{w.id}/approve", json={"note": "op-123"}, headers=auth(admin)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "completed"
    assert points_of(session, admin.id) == 500


def test_approve_is_recorded_in_audit_log(client, session, admin):
    admin.points = 1000
    session.commit()
    w = make_withdrawal(session, admin, 500)
    client.post(f"/api/v1/admin/withdrawals/{w.id}/approve", json={"note": "op-123"}, headers=auth(admin))

    session.expire_all()
    log = session.exec(select(AdminLog)).one()
    assert log.action == "withdrawal.approve"
    assert log.admin_user_id == admin.id
    assert log.target_id == str(w.id)
    assert log.note == "op-123"
    assert log.detail["points"] == 500


# ---------------------------------------------------------------- 換金の却下

def test_reject_refunds_points(client, session, admin):
    """却下したら必ずポイントが戻ること。戻らないとユーザーの残高が消える"""
    admin.points = 1000
    session.commit()
    w = make_withdrawal(session, admin, 500)
    assert points_of(session, admin.id) == 500

    res = client.post(
        f"/api/v1/admin/withdrawals/{w.id}/reject", json={"note": "Número inválido"}, headers=auth(admin)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "rejected"
    assert points_of(session, admin.id) == 1000


def test_reject_is_recorded_with_refund_amount(client, session, admin):
    admin.points = 1000
    session.commit()
    w = make_withdrawal(session, admin, 500)
    client.post(f"/api/v1/admin/withdrawals/{w.id}/reject", json={}, headers=auth(admin))

    session.expire_all()
    log = session.exec(select(AdminLog)).one()
    assert log.action == "withdrawal.reject"
    assert log.detail["points_refunded"] == 500


# ---------------------------------------------------------------- 二重処理

@pytest.mark.parametrize("first,second", [("approve", "approve"), ("approve", "reject"), ("reject", "approve")])
def test_cannot_process_twice(client, session, admin, first, second):
    """終端状態に達した申請は再処理できないこと（二重送金・二重返還の防止）"""
    admin.points = 1000
    session.commit()
    w = make_withdrawal(session, admin, 500)

    assert client.post(f"/api/v1/admin/withdrawals/{w.id}/{first}", json={}, headers=auth(admin)).status_code == 200
    after_first = points_of(session, admin.id)

    res = client.post(f"/api/v1/admin/withdrawals/{w.id}/{second}", json={}, headers=auth(admin))
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "ALREADY_PROCESSED"
    assert points_of(session, admin.id) == after_first


def test_unknown_withdrawal_returns_404(client, admin):
    res = client.post(f"/api/v1/admin/withdrawals/{uuid.uuid4()}/approve", json={}, headers=auth(admin))
    assert res.status_code == 404


# ---------------------------------------------------------------- 一覧の絞り込み

def test_unknown_filter_falls_back_to_all(client, session, admin):
    """廃止した絞り込み値のブックマークで空振りしないこと"""
    admin.points = 1000
    session.commit()
    make_withdrawal(session, admin, 500)

    res = client.get("/api/v1/admin/withdrawals?status=obsoleto", headers=auth(admin))
    assert res.status_code == 200
    assert res.json()["page"]["total"] == 1


def test_valid_filter_narrows_results(client, session, admin):
    admin.points = 1000
    session.commit()
    make_withdrawal(session, admin, 500)

    assert client.get("/api/v1/admin/withdrawals?status=pending", headers=auth(admin)).json()["page"]["total"] == 1
    assert client.get("/api/v1/admin/withdrawals?status=completed", headers=auth(admin)).json()["page"]["total"] == 0


def test_user_detail_includes_history(client, session, admin):
    admin.points = 1000
    session.commit()
    make_withdrawal(session, admin, 500)

    res = client.get(f"/api/v1/admin/users/{admin.id}", headers=auth(admin))
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["id"] == admin.id
    assert len(body["withdrawals"]) == 1


# ---------------------------------------------------------------- 苦情記録簿

def test_respond_complaint_marks_and_logs(client, session, admin):
    c = Complaint(
        # numberは本番ではPostgresのIDENTITYが採番するが、SQLiteはそれを再現できないので明示する
        number=1,
        tipo="reclamo",
        consumidor_nombre="Ana",
        consumidor_domicilio="Lima",
        consumidor_documento_tipo="DNI",
        consumidor_documento_numero="12345678",
        consumidor_email="ana@example.com",
        bien_tipo="servicio",
        bien_descripcion="Puntos",
        detalle="No recibí mis puntos",
        pedido="Revisión",
    )
    session.add(c)
    session.commit()
    session.refresh(c)

    res = client.post(f"/api/v1/admin/complaints/{c.id}/respond", json={}, headers=auth(admin))
    assert res.status_code == 200
    assert res.json()["status"] == "respondido"

    session.expire_all()
    assert session.exec(select(AdminLog)).one().action == "complaint.respond"

    # 二重対応は弾く
    assert client.post(f"/api/v1/admin/complaints/{c.id}/respond", json={}, headers=auth(admin)).status_code == 409


# ---------------------------------------------------------------- /me の is_admin

def test_me_exposes_admin_flag(client, session, admin, user):
    """フロントの管理画面ガードは /me の is_admin を見る。

    MeResponseはフィールドを明示的に組み立てているため、モデルに列を足しただけでは
    既定値が返ってしまう（実際にそれで管理者が締め出された）
    """
    assert client.get("/api/v1/me", headers=auth(admin)).json()["is_admin"] is True
    assert client.get("/api/v1/me", headers=auth(user)).json()["is_admin"] is False


# ------------------------------------------------- キャンペーン設定

def test_campaign_settings_requires_admin(client, user):
    """一般ユーザーは設定を変えられない"""
    res = client.put(
        "/api/v1/admin/campaign-settings",
        headers=auth(user),
        json={"slot_limit": 200, "reward_points_initial": 500, "reward_points_bonus": 200, "bonus_required_tasks": 1, "withdrawals_open_at": "2026-10-01", "referral_reward_points": 200, "referral_max_per_user": 20, "referral_required_earnings": 500},
    )
    assert res.status_code in (401, 403)


def test_campaign_settings_update(client, session, admin):
    res = client.put(
        "/api/v1/admin/campaign-settings",
        headers=auth(admin),
        json={"slot_limit": 200, "reward_points_initial": 700, "reward_points_bonus": 200, "bonus_required_tasks": 1, "withdrawals_open_at": "2026-11-15", "referral_reward_points": 200, "referral_max_per_user": 20, "referral_required_earnings": 500},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["slot_limit"] == 200
    assert body["reward_points_initial"] == 700
    assert body["withdrawals_open_at"] == "2026-11-15"
    assert body["updated_by_email"] == "admin@example.com"

    # 公開APIにも即座に反映される（再起動を要さないのがこの機能の目的）
    public = client.get("/api/v1/campaign/status").json()
    assert public["slot_limit"] == 200
    assert public["reward_points_initial"] == 700
    assert public["withdrawals_open_at"] == "2026-11-15"


def test_campaign_settings_change_is_logged(client, session, admin):
    """金の出入りに効く設定なので、誰が何をどう変えたかを残す"""
    client.put(
        "/api/v1/admin/campaign-settings",
        headers=auth(admin),
        json={"slot_limit": 150, "reward_points_initial": 500, "reward_points_bonus": 200, "bonus_required_tasks": 1, "withdrawals_open_at": "2026-10-01", "referral_reward_points": 200, "referral_max_per_user": 20, "referral_required_earnings": 500},
    )
    log = session.exec(
        select(AdminLog).where(AdminLog.action == "campaign_settings.update")
    ).one()
    assert log.admin_user_id == admin.id
    assert log.detail["before"]["slot_limit"] == 100
    assert log.detail["after"]["slot_limit"] == 150


def test_campaign_settings_open_now_needs_confirmation(client, admin):
    """開放日を空にすると全員が即座に交換できる。誤操作を一段止める"""
    res = client.put(
        "/api/v1/admin/campaign-settings",
        headers=auth(admin),
        json={"slot_limit": 100, "reward_points_initial": 500, "reward_points_bonus": 200, "bonus_required_tasks": 1, "withdrawals_open_at": None, "referral_reward_points": 200, "referral_max_per_user": 20, "referral_required_earnings": 500},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "CONFIRM_OPEN_NOW_REQUIRED"

    res = client.put(
        "/api/v1/admin/campaign-settings",
        headers=auth(admin),
        json={
            "slot_limit": 100,
            "reward_points_initial": 500,
            "reward_points_bonus": 200,
            "bonus_required_tasks": 1,
            "withdrawals_open_at": None,
            "referral_reward_points": 200,
            "referral_max_per_user": 20, "referral_required_earnings": 500,
            "confirm_open_now": True,
        },
    )
    assert res.status_code == 200
    assert client.get("/api/v1/campaign/status").json()["withdrawals_open"] is True


def test_campaign_settings_cannot_go_below_granted(client, session, admin):
    """付与済みの人数より枠を小さくできない。

    付与は取り消さないので、許すと「枠外なのに報酬を持っている人」が生まれ、
    残り枠の表示と実態が食い違う
    """
    from services import campaign_service

    for i in range(3):
        u = User(provider_user_id=f"g-cs{i}", email=f"cs{i}@example.com", name=f"CS{i}")
        session.add(u)
        session.commit()
        session.refresh(u)
        complete_registration(session, u, phone=f"98765432{i}")

    res = client.put(
        "/api/v1/admin/campaign-settings",
        headers=auth(admin),
        json={"slot_limit": 2, "reward_points_initial": 500, "reward_points_bonus": 200, "bonus_required_tasks": 1, "withdrawals_open_at": "2026-10-01", "referral_reward_points": 200, "referral_max_per_user": 20, "referral_required_earnings": 500},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "SLOT_LIMIT_BELOW_GRANTED"


# ------------------------------------------------- ユーザー詳細（台帳・キャンペーン・招待）

def test_user_detail_includes_ledger(client, session, admin, user):
    """増減の理由が管理側から見えること。問い合わせ対応の起点になる"""
    from services import campaign_service

    complete_registration(session, user)

    body = client.get(f"/api/v1/admin/users/{user.id}", headers=auth(admin)).json()
    tx = body["point_transactions"]
    assert [t["kind"] for t in tx] == ["campaign"]
    assert tx[0]["points"] == 300
    assert tx[0]["note"] == "Bono de pre-registro"


def test_user_detail_reports_ledger_drift(client, session, admin, user):
    """台帳の合計と残高がずれたら気づけること。

    ずれは「台帳を書かずに残高を動かした経路がある」という意味なので、
    見えないと直す機会がない
    """
    from services import campaign_service

    complete_registration(session, user)

    body = client.get(f"/api/v1/admin/users/{user.id}", headers=auth(admin)).json()
    assert body["ledger_total"] == body["user"]["points"]  # 一致が正常

    # 台帳を書かずに残高だけ動かす（本来あってはならない操作）
    user.points += 999
    session.add(user)
    session.commit()

    body = client.get(f"/api/v1/admin/users/{user.id}", headers=auth(admin)).json()
    assert body["ledger_total"] != body["user"]["points"]


def test_user_detail_includes_campaign_progress(client, session, user, admin):
    """先着番号は登録順（users.id）で決まるので、user を先に作る"""
    from services import campaign_service

    complete_registration(session, user)

    c = client.get(f"/api/v1/admin/users/{user.id}", headers=auth(admin)).json()["campaign"]
    assert c["position"] == 1
    assert c["within_limit"] is True
    assert c["reward_granted_at"] is not None
    assert c["bonus_granted_at"] is None  # タスク未完了
    assert c["tasks_completed"] == 0
    assert c["bonus_required_tasks"] == 1


def test_user_detail_includes_referral(client, session, admin, user):
    """自作自演を疑ったときに「誰が誰を招待したか」を辿れること"""
    import datetime as dt

    from services import referral_service
    from tests.conftest import set_campaign

    code = referral_service.ensure_code(session, user)

    invitee = User(provider_user_id="g-inv-d", email="inv-d@example.com", name="Inv")
    session.add(invitee)
    session.commit()
    session.refresh(invitee)
    referral_service.claim(session, invitee, code)
    # 成立は招待された人がタスクで稼いだとき
    earn_from_task(session, invitee, 500, "inv-d-t1")

    r = client.get(f"/api/v1/admin/users/{user.id}", headers=auth(admin)).json()["referral"]
    assert r["code"] == code
    assert r["invited_total"] == 1
    assert r["invited_settled"] == 1
    assert r["earned_points"] == 200
    assert r["invited_by_email"] is None

    # 招待された側からは「誰に招待されたか」が見える
    r2 = client.get(f"/api/v1/admin/users/{invitee.id}", headers=auth(admin)).json()["referral"]
    assert r2["invited_by_email"] == user.email
    assert r2["invited_by_user_id"] == user.id


# ------------------------------------------------- 先着枠からの除外

def test_campaign_exclusion_revokes_and_frees_slot(client, session, admin):
    """管理者や検証用のアカウントが埋めた枠を戻せること"""
    from services import campaign_service
    from tests.conftest import set_campaign

    set_campaign(session, slot_limit=1)
    u = User(provider_user_id="g-ex", email="ex@example.com", name="Ex")
    session.add(u)
    session.commit()
    session.refresh(u)
    complete_registration(session, u, phone="987654322")
    assert client.get("/api/v1/campaign/status").json()["remaining"] == 0

    res = client.post(
        f"/api/v1/admin/users/{u.id}/campaign-exclusion",
        headers=auth(admin),
        json={"excluded": True},
    )
    assert res.status_code == 200
    assert res.json()["excluded"] is True
    assert res.json()["reward_granted_at"] is None

    session.refresh(u)
    assert u.points == 0
    assert client.get("/api/v1/campaign/status").json()["remaining"] == 1


def test_campaign_exclusion_requires_admin(client, session, user):
    res = client.post(
        f"/api/v1/admin/users/{user.id}/campaign-exclusion",
        headers=auth(user),
        json={"excluded": True},
    )
    assert res.status_code in (401, 403)


def test_campaign_exclusion_is_logged(client, session, admin, user):
    """金が動く操作なので、誰が何をしたか残す"""
    client.post(
        f"/api/v1/admin/users/{user.id}/campaign-exclusion",
        headers=auth(admin),
        json={"excluded": True},
    )
    log = session.exec(
        select(AdminLog).where(AdminLog.action == "user.campaign_exclusion")
    ).one()
    assert log.detail["excluded"] is True
