from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class PointTransaction(SQLModel, table=True):
    """ポイントの増減を1件ずつ残す台帳。

    **`users.points` を動かすときは必ずここに1行書く。** 残高だけを足し引きすると、
    ユーザーには「増えた理由が分からない残高」しか見えなくなる。
    金を扱う以上、残高と履歴が合わない状態を作らない。

    ⚠️ 未確定の成果（`postbacks.status = 'pending'`）はここに書かない。
       まだ残高に入っていないため。台帳は**実際に動いた分だけ**を持つ。
    """

    __tablename__ = "point_transactions"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    # 符号つき。獲得は正、消費は負。合計が users.points と一致する
    points: int

    # campaign        事前登録キャンペーンの報酬
    # referral        招待の成立報酬（招待した側）
    # offer           オファーウォールの成果承認
    # offer_reversal  承認後の否認による取り消し
    # withdrawal      Yape換金の申請（消費）
    # topup           携帯チャージ交換（消費）
    # refund          却下・失敗による返還
    # adjustment      管理者による手動調整
    kind: str = Field(index=True)

    # 元になった行への参照。問い合わせ対応で辿れるようにする
    reference_type: Optional[str] = Field(default=None)
    reference_id: Optional[str] = Field(default=None, index=True)

    # 画面に出す短い説明（案件名、招待した相手の名前など）
    note: Optional[str] = Field(default=None)

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), index=True
    )
