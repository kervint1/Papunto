"""事前登録キャンペーンの報酬付与。

登録した時点で付与する。交換は10/1まで開かないが、**残高が増えるのが
見えないと進んでいる実感がない**ため、付与自体は即時にする。

枠の判定は「付与済みの人数」で行う。登録者数で数えると、キャンペーン開始前に
登録したユーザーが枠を消費してしまう。
"""
import datetime as dt

from sqlmodel import Session

from models import User
from services import campaign_service
from services.auth_service import AuthService
from tests.conftest import set_campaign


def auth(u: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(u.id)}"}


def make_user(session: Session, suffix: str) -> User:
    u = User(provider_user_id=f"g-{suffix}", email=f"{suffix}@example.com", name=suffix)
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


# ---------------------------------------------------------------- 付与

def test_grants_reward(session):
    set_campaign(session, reward_points_initial=500, slot_limit=100)
    u = make_user(session, "a")

    assert campaign_service.grant_reward(session, u) is True
    session.commit()

    assert u.points == 500
    assert u.campaign_reward_granted_at is not None


def test_amount_is_configurable(session):
    set_campaign(session, reward_points_initial=200, slot_limit=100)
    u = make_user(session, "b")

    campaign_service.grant_reward(session, u)
    assert u.points == 200


def test_adds_to_existing_points(session):
    """既存の残高を上書きしない"""
    set_campaign(session, reward_points_initial=500, slot_limit=100)
    u = make_user(session, "c")
    u.points = 300
    session.add(u)
    session.commit()

    campaign_service.grant_reward(session, u)
    assert u.points == 800


# ---------------------------------------------------------------- 二重付与の防止

def test_never_grants_twice(session):
    """金が動くので、ここだけは確実に防ぐ"""
    set_campaign(session, reward_points_initial=500, slot_limit=100)
    u = make_user(session, "d")

    assert campaign_service.grant_reward(session, u) is True
    session.commit()
    assert campaign_service.grant_reward(session, u) is False
    session.commit()

    assert u.points == 500


# ---------------------------------------------------------------- 枠の判定

def test_stops_at_limit(session):
    set_campaign(session, reward_points_initial=500, slot_limit=2)

    granted = []
    for i in range(4):
        u = make_user(session, f"e{i}")
        granted.append(campaign_service.grant_reward(session, u))
        session.commit()

    assert granted == [True, True, False, False]
    assert campaign_service.granted_count(session) == 2


def test_counts_granted_not_registered(session):
    """登録者数ではなく付与済み数で数える。
    キャンペーン開始前に登録したユーザーが枠を消費しないように"""
    set_campaign(session, reward_points_initial=500, slot_limit=1)

    # 開始前からいるユーザー（付与されていない）
    make_user(session, "old1")
    make_user(session, "old2")
    assert campaign_service.granted_count(session) == 0

    # 新規は枠を使える
    newcomer = make_user(session, "new")
    assert campaign_service.grant_reward(session, newcomer) is True


def test_limit_change_reopens_slots(session):
    """100名で始めて増やす運用。設定を変えるだけで再開できる"""
    set_campaign(session, reward_points_initial=500, slot_limit=1)

    first = make_user(session, "f1")
    campaign_service.grant_reward(session, first)
    session.commit()

    second = make_user(session, "f2")
    assert campaign_service.grant_reward(session, second) is False

    set_campaign(session, slot_limit=2)
    assert campaign_service.grant_reward(session, second) is True


# ---------------------------------------------------------------- ログインとの連携

def test_granted_at_is_recorded(session):
    """いつ付与したかを残す。問い合わせ対応で辿れるようにするため"""
    set_campaign(session, reward_points_initial=500, slot_limit=100)
    before = dt.datetime.now(dt.timezone.utc)

    u = make_user(session, "g")
    campaign_service.grant_reward(session, u)
    session.commit()

    granted = u.campaign_reward_granted_at
    assert granted is not None
    # SQLiteはtz情報を落とすので、素朴な比較にする
    assert granted.replace(tzinfo=None) >= before.replace(tzinfo=None)


# ---------------------------------------------------------------- 残り分（ボーナス）

def _approve_task(session: Session, user: User, tid: str):
    """成果が承認された状態を作る。ボーナスの条件はこれの件数"""
    from services import postback_service

    postback_service.process_conversion(
        session,
        provider="cpalead",
        userid=str(user.id),
        transaction_id=tid,
        reward_points=100,
        status="approved",
    )


def test_bonus_is_not_granted_on_registration(session):
    """登録しただけでは残り200ptは入らない。

    500ptを一度に渡すと開放日に引き出して終わりになるので、
    300ptだけ渡して最低交換額（500pt）に届かない状態にしておく
    """
    u = make_user(session, "b1")
    campaign_service.grant_reward(session, u)
    session.commit()

    assert u.points == 300
    assert u.campaign_bonus_granted_at is None


def test_bonus_is_granted_after_required_tasks(session):
    u = make_user(session, "b2")
    campaign_service.grant_reward(session, u)
    session.commit()

    _approve_task(session, u, "b2-t1")
    session.refresh(u)

    assert u.campaign_bonus_granted_at is not None
    # 300（初回） + 100（タスク報酬） + 200（残り）
    assert u.points == 600


def test_bonus_waits_for_the_required_count(session):
    set_campaign(session, bonus_required_tasks=2)
    u = make_user(session, "b3")
    campaign_service.grant_reward(session, u)
    session.commit()

    _approve_task(session, u, "b3-t1")
    session.refresh(u)
    assert u.campaign_bonus_granted_at is None

    _approve_task(session, u, "b3-t2")
    session.refresh(u)
    assert u.campaign_bonus_granted_at is not None


def test_bonus_is_granted_only_once(session):
    u = make_user(session, "b4")
    campaign_service.grant_reward(session, u)
    session.commit()

    _approve_task(session, u, "b4-t1")
    _approve_task(session, u, "b4-t2")
    session.refresh(u)

    granted_at = u.campaign_bonus_granted_at
    assert u.points == 300 + 100 + 200 + 100  # 残りは1回だけ
    assert u.campaign_bonus_granted_at == granted_at


def test_bonus_requires_the_initial_grant(session):
    """枠外で登録した人がタスクだけこなして残りを取る穴を塞ぐ"""
    set_campaign(session, slot_limit=0)
    u = make_user(session, "b5")
    assert campaign_service.grant_reward(session, u) is False
    session.commit()

    _approve_task(session, u, "b5-t1")
    session.refresh(u)

    assert u.campaign_bonus_granted_at is None
    assert u.points == 100  # タスク報酬だけ


def test_pending_task_does_not_count(session):
    """未承認の成果では残りを出さない。

    数えると、承認されない成果を大量に出すだけで取れてしまう
    """
    from services import postback_service

    u = make_user(session, "b6")
    campaign_service.grant_reward(session, u)
    session.commit()

    postback_service.process_conversion(
        session,
        provider="cpalead",
        userid=str(u.id),
        transaction_id="b6-t1",
        reward_points=100,
        status="pending",
    )
    session.refresh(u)
    assert u.campaign_bonus_granted_at is None
    assert u.points == 300


def test_progress_is_reported(client, session):
    u = make_user(session, "b7")
    campaign_service.grant_reward(session, u)
    session.commit()

    body = client.get("/api/v1/campaign/me", headers=auth(u)).json()
    assert body["tasks_completed"] == 0
    assert body["bonus_required_tasks"] == 1
    assert body["bonus_granted"] is False

    _approve_task(session, u, "b7-t1")
    body = client.get("/api/v1/campaign/me", headers=auth(u)).json()
    assert body["tasks_completed"] == 1
    assert body["bonus_granted"] is True
    assert body["bonus_points"] == 200


# ---------------------------------------------------------------- 先着枠からの除外

def test_excluded_user_gets_nothing(session):
    """管理者や検証用のアカウントが先着枠を消費しないこと"""
    u = make_user(session, "ex1")
    u.campaign_excluded = True
    session.add(u)
    session.commit()

    assert campaign_service.grant_reward(session, u) is False
    assert u.points == 0


def test_admin_gets_nothing(session):
    """除外の設定を忘れたときの保険"""
    u = make_user(session, "ex2")
    u.is_admin = True
    session.add(u)
    session.commit()

    assert campaign_service.grant_reward(session, u) is False


def test_excluded_user_does_not_consume_a_slot(client, session):
    """除外したアカウントは残り枠を減らさない"""
    set_campaign(session, slot_limit=2)
    a = make_user(session, "ex3")
    campaign_service.grant_reward(session, a)
    session.commit()
    assert client.get("/api/v1/campaign/status").json()["remaining"] == 1

    a.campaign_excluded = True
    session.add(a)
    session.commit()
    assert client.get("/api/v1/campaign/status").json()["remaining"] == 2


def test_position_skips_excluded_users(session):
    """番号が除外を飛ばすこと。

    ユーザーには番号を見せないが、**管理画面では出す**。そこで
    検証用アカウントを数えると、最初の実ユーザーが3番目に見える
    """
    admin = make_user(session, "ex4")
    admin.campaign_excluded = True
    session.add(admin)
    session.commit()

    real = make_user(session, "ex5")
    assert campaign_service.position_of(session, real) == 1


# ---------------------------------------------------------------- 取り消し

def test_revoke_returns_points_and_frees_the_slot(client, session):
    """取り消せないと、埋めた枠が永久に戻らない"""
    set_campaign(session, slot_limit=1)
    u = make_user(session, "rev1")
    campaign_service.grant_reward(session, u)
    session.commit()
    assert u.points == 300
    assert client.get("/api/v1/campaign/status").json()["remaining"] == 0

    returned = campaign_service.revoke_reward(session, u)
    u.campaign_excluded = True
    session.add(u)
    session.commit()

    assert returned == 300
    assert u.points == 0
    assert u.campaign_reward_granted_at is None
    assert client.get("/api/v1/campaign/status").json()["remaining"] == 1


def test_revoke_takes_back_the_bonus_too(session):
    u = make_user(session, "rev2")
    campaign_service.grant_reward(session, u)
    session.commit()
    _approve_task(session, u, "rev2-t1")
    session.refresh(u)
    assert u.points == 600  # 300 + 100(タスク) + 200(ボーナス)

    campaign_service.revoke_reward(session, u)
    session.commit()

    # キャンペーン分だけ戻り、タスクの報酬は残る
    assert u.points == 100
    assert u.campaign_bonus_granted_at is None


def test_revoke_is_recorded_in_the_ledger(session):
    """履歴から消すのではなく「取り消した」として残す"""
    from models import PointTransaction
    from sqlmodel import select as _select

    u = make_user(session, "rev3")
    campaign_service.grant_reward(session, u)
    session.commit()
    campaign_service.revoke_reward(session, u)
    session.commit()

    kinds = [t.kind for t in session.exec(
        _select(PointTransaction).where(PointTransaction.user_id == u.id)
    ).all()]
    assert kinds == ["campaign", "campaign_revoked"]


def test_revoke_is_a_noop_when_nothing_granted(session):
    u = make_user(session, "rev4")
    assert campaign_service.revoke_reward(session, u) == 0
    assert u.points == 0
