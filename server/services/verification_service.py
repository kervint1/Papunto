"""本人の確からしさ。

## なぜ交換先ごとに扱いを変えるのか

交換先によって、**受け取る人と本人の結びつきの強さが違う**。

| 交換先 | 本人との紐づき |
| --- | --- |
| Yape | **DNI**。同じDNIでは1アカウントが基本で、増やすには別のデビットカードが要る |
| 携帯チャージ | **無し**。番号さえあれば届く。SIMを増やすだけで重複できる |
| ギフトカード | **無し**。コードが届くだけ。流動性が高く転売もできる |

ペルーではSIMを複数持つ人が珍しくないので、電話番号のUNIQUEだけでは
「同一人物が複数アカウント」を防げない。**Yapeを通すと、そこにDNIの制約が効く。**

## 規則

**Yapeでの送金が1回でも完了していれば、他の交換先も開く。**

1回通れば、送金時に受取人名が確認でき、DNIに紐づいた口座であることも
確かめられる。それ以降は他の手段を使っても、同一人物の重複は検出済み。

摩擦は初回だけで、しかも初回は利用者側にも「本当に払われるか確かめたい」
動機があるので、Yapeを選ぶ理由がある。
"""
from sqlmodel import Session, func, select

from models import User, Withdrawal

# この交換先は本人との紐づきが弱いので、Yapeでの実績を求める
ANCHORED_DESTINATIONS = frozenset({"recarga", "paypal"})


def has_completed_yape_withdrawal(session: Session, user: User) -> bool:
    """Yapeでの送金が完了したことがあるか"""
    count = session.exec(
        select(func.count())
        .select_from(Withdrawal)
        .where(Withdrawal.user_id == user.id, Withdrawal.status == "completed")
    ).one()
    return int(count) > 0


def can_use_destination(session: Session, user: User, destination: str) -> bool:
    if destination not in ANCHORED_DESTINATIONS:
        return True
    return has_completed_yape_withdrawal(session, user)
