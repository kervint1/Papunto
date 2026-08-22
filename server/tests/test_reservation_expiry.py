"""枠の有効期限。

登録はメールアドレスだけででき、その瞬間に枠を消費する。期限が無いと
**フリーメールで手動登録するだけで100枠を埋められる**。番号が無ければ
1ptも出ないので金銭的な損は無いが、キャンペーンの目的である
「実ユーザーを100人集める」が達成できなくなる。
"""
import datetime as dt

from sqlmodel import Session

from models import User
from services import campaign_service
from services.auth_service import AuthService
from tests.conftest import set_campaign


def auth(u: User) -> dict:
    return {"Authorization": f"Bearer {AuthService.create_access_token(u.id)}"}


def age_reservation(session: Session, user: User, days: int):
    """枠を確保した時刻を過去にずらす"""
    user.campaign_reserved_at = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=days)
    session.add(user)
    session.commit()
    session.refresh(user)


def test_期限内なら枠を保持する(client, session: Session, user: User):
    age_reservation(session, user, 6)
    assert campaign_service.reserved_count(session) == 1


def test_期限を過ぎたら枠が戻る(client, session: Session, user: User):
    """放置された枠が次の人に回る"""
    age_reservation(session, user, 8)
    assert campaign_service.reserved_count(session) == 0


def test_番号を登録済みなら期限は効かない(client, session: Session, user: User):
    """受け取った人の枠は確定。何日経っても取り上げない"""
    user.campaign_reward_granted_at = dt.datetime.now(dt.timezone.utc)
    session.add(user)
    age_reservation(session, user, 400)

    assert campaign_service.reserved_count(session) == 1


def test_期限切れ後に番号を入れても受け取れない(client, session: Session, user: User):
    """ここを見ないと、放置して期限が切れた人が後から番号を入れるだけで
    受け取れてしまい、枠を返した意味が無くなる"""
    age_reservation(session, user, 8)
    user.phone = "987654321"
    session.add(user)
    session.flush()

    assert campaign_service.grant_reward(session, user) is False
    assert user.points == 0


def test_期限切れは枠外として扱う(client, session: Session, user: User):
    age_reservation(session, user, 8)

    body = client.get("/api/v1/campaign/me", headers=auth(user)).json()

    assert body["within_limit"] is False


def test_期限を画面に返す(client, session: Session, user: User):
    """黙って枠を消すのは、告知していても不親切"""
    body = client.get("/api/v1/campaign/me", headers=auth(user)).json()

    assert body["reservation_deadline"] is not None


def test_受け取り済みなら期限を返さない(client, session: Session, user: User):
    user.campaign_reward_granted_at = dt.datetime.now(dt.timezone.utc)
    session.add(user)
    session.commit()

    body = client.get("/api/v1/campaign/me", headers=auth(user)).json()

    assert body["reservation_deadline"] is None


def test_期限切れの枠は次の人が取れる(client, session: Session, user: User):
    """枠が戻る＝新しい人が入れる、が成立していること"""
    set_campaign(session, slot_limit=1)
    age_reservation(session, user, 8)

    nuevo = User(provider_user_id="g-nuevo", email="nuevo@example.com")
    session.add(nuevo)
    session.flush()

    assert campaign_service.reserve_slot(session, nuevo) is True


def test_日数は設定から変えられる(client, session: Session, user: User):
    """キャンペーン中に触る値なので環境変数ではなくDBに置いている"""
    age_reservation(session, user, 8)
    assert campaign_service.reserved_count(session) == 0

    set_campaign(session, reservation_days=30)
    assert campaign_service.reserved_count(session) == 1
