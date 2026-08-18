"""ポストバック処理のテスト基盤。

対象はお金が動く経路（署名検証・冪等性・状態遷移・付与上限）に絞っている。
DBはSQLiteのインメモリを使うため、`with_for_update()` は no-op になり
**行ロックそのものの検証はできない**。分岐とデータの整合性の検証に用途を限定する。
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config  # noqa: E402
from database import get_session  # noqa: E402
from main import app  # noqa: E402
from models import CampaignSetting, User  # noqa: E402

ALLOWED_IP = "203.0.113.10"
API_KEY = "test-api-key"
POSTBACK_SECRET = "test-postback-secret"


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # インメモリDBを接続間で共有する
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="client")
def client_fixture(session: Session):
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def cpalead_settings(monkeypatch):
    """CPALeadの設定を固定する。

    config はモジュールレベルの定数なので、環境変数ではなく属性を直接差し替える
    """
    monkeypatch.setattr(config, "CPALEAD_MOCK", False)
    monkeypatch.setattr(config, "CPALEAD_API_KEY", API_KEY)
    monkeypatch.setattr(config, "CPALEAD_POSTBACK_SECRET", POSTBACK_SECRET)
    monkeypatch.setattr(config, "CPALEAD_ALLOWED_IPS", [ALLOWED_IP])
    monkeypatch.setattr(config, "CPALEAD_USD_TO_POINTS", 300)
    monkeypatch.setattr(config, "MAX_REWARD_POINTS", 100000)


@pytest.fixture(autouse=True)
def campaign_setting(session: Session):
    """キャンペーン設定の行を既定値で用意する。

    本番はマイグレーションが1行投入するが、テストは create_all で
    テーブルだけ作られるので、ここで同じ役割を担う。

    ⚠️ 開放日は None（＝即開放）にしておく。交換を検証するテストの大半は
    キャンペーンの日付と関係がないため。開放日そのものを見るテストは
    set_campaign() で上書きする
    """
    setting = CampaignSetting(
        id=1,
        slot_limit=100,
        # 報酬は2段。300は最低交換額に届かず、タスク1件で残り200が入る
        reward_points_initial=300,
        reward_points_bonus=200,
        bonus_required_tasks=1,
        withdrawals_open_at=None,
    )
    session.add(setting)
    session.commit()
    session.refresh(setting)
    return setting


def set_campaign(session: Session, **fields):
    """テストからキャンペーン設定を変える。

    設定はDBにあるので monkeypatch では変えられない
    """
    setting = session.get(CampaignSetting, 1)
    for key, value in fields.items():
        setattr(setting, key, value)
    session.add(setting)
    session.commit()
    session.refresh(setting)
    return setting


@pytest.fixture(name="user")
def user_fixture(session: Session):
    user = User(google_id="google-test-1", email="test@example.com", name="Test", points=0)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
