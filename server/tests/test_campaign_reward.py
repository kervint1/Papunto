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
from tests.conftest import set_campaign


def make_user(session: Session, suffix: str) -> User:
    u = User(google_id=f"g-{suffix}", email=f"{suffix}@example.com", name=suffix)
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


# ---------------------------------------------------------------- 付与

def test_grants_reward(session):
    set_campaign(session, reward_points=500, slot_limit=100)
    u = make_user(session, "a")

    assert campaign_service.grant_reward(session, u) is True
    session.commit()

    assert u.points == 500
    assert u.campaign_reward_granted_at is not None


def test_amount_is_configurable(session):
    set_campaign(session, reward_points=200, slot_limit=100)
    u = make_user(session, "b")

    campaign_service.grant_reward(session, u)
    assert u.points == 200


def test_adds_to_existing_points(session):
    """既存の残高を上書きしない"""
    set_campaign(session, reward_points=500, slot_limit=100)
    u = make_user(session, "c")
    u.points = 300
    session.add(u)
    session.commit()

    campaign_service.grant_reward(session, u)
    assert u.points == 800


# ---------------------------------------------------------------- 二重付与の防止

def test_never_grants_twice(session):
    """金が動くので、ここだけは確実に防ぐ"""
    set_campaign(session, reward_points=500, slot_limit=100)
    u = make_user(session, "d")

    assert campaign_service.grant_reward(session, u) is True
    session.commit()
    assert campaign_service.grant_reward(session, u) is False
    session.commit()

    assert u.points == 500


# ---------------------------------------------------------------- 枠の判定

def test_stops_at_limit(session):
    set_campaign(session, reward_points=500, slot_limit=2)

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
    set_campaign(session, reward_points=500, slot_limit=1)

    # 開始前からいるユーザー（付与されていない）
    make_user(session, "old1")
    make_user(session, "old2")
    assert campaign_service.granted_count(session) == 0

    # 新規は枠を使える
    newcomer = make_user(session, "new")
    assert campaign_service.grant_reward(session, newcomer) is True


def test_limit_change_reopens_slots(session):
    """100名で始めて増やす運用。設定を変えるだけで再開できる"""
    set_campaign(session, reward_points=500, slot_limit=1)

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
    set_campaign(session, reward_points=500, slot_limit=100)
    before = dt.datetime.now(dt.timezone.utc)

    u = make_user(session, "g")
    campaign_service.grant_reward(session, u)
    session.commit()

    granted = u.campaign_reward_granted_at
    assert granted is not None
    # SQLiteはtz情報を落とすので、素朴な比較にする
    assert granted.replace(tzinfo=None) >= before.replace(tzinfo=None)
