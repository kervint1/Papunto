from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Referral(SQLModel, table=True):
    """招待の1件。招待元と招待先を1対1で結ぶ。

    広告の代わりの集客経路。ペルーはWhatsApp中心で、友達からのリンクの方が
    広告より強く効く。

    ⚠️ 自作自演（複数アカウントで自分を招待する）が最大のリスク。
       これを止めているのは `users.phone` のUNIQUE制約であって、
       ここのロジックではない。報酬はポイントで即時に付くが、
       現金になるのは電話番号の登録を経た換金だけなので、
       **金が出る前に必ず一意性の検査を通る**設計になっている。
    """

    __tablename__ = "referrals"

    id: Optional[int] = Field(default=None, primary_key=True)

    inviter_user_id: int = Field(foreign_key="users.id", index=True)
    # 招待された側。**1人が招待されるのは1回だけ**なのでUNIQUE。
    # 後から別の招待元に付け替えることもできない
    invitee_user_id: int = Field(foreign_key="users.id", unique=True, index=True)

    # 使われた招待コード。招待元のコードを後から変えても、
    # どのコード経由で来たかを追えるように実体をコピーしておく
    code: str = Field(index=True)

    # 成立した時刻。NULL は「紐づいたが、まだ成立条件を満たしていない」。
    # 成立の条件は時期で変わる（services/referral_service.py 参照）
    settled_at: Optional[datetime] = Field(default=None, index=True)
    # 成立時に招待元へ付与したポイント。後でレートを変えても履歴が壊れない
    reward_points: int = Field(default=0)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
