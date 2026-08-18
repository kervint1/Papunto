"""事前登録キャンペーン。

先着順は **登録順（users.id の昇順）** で決まる。Googleログインだけで
番号が確定するので、電話番号やタスクを求めずに「あなたは37人目です」と
即座に返せる。摩擦を最小にして登録数を最大化するための設計。

不正の判定は送金の前に行う。電話番号の登録は10/1以降なので、
同一番号の重複はそこで発覚し、**1円も払う前に除外できる**。

⚠️ 除外条件は事前に具体的に告知すること。ペルーはINDECOPIの消費者保護が
   効いており、「当社の判断により除外」のような曖昧な条項は不当条項と
   みなされ得る。実装と告知（LPの注意事項）を必ず一致させる。
"""
import datetime as dt
import logging
from dataclasses import dataclass

from sqlmodel import Session, func, select

from models import CampaignSetting, User

logger = logging.getLogger(__name__)


def get_settings(session: Session) -> CampaignSetting:
    """キャンペーン設定を返す。**行が無ければ既定値の一時オブジェクト**を返す。

    読み取りでDBに書かないのは、未ログインでも叩ける /campaign/status から
    呼ばれるため。行はマイグレーションで投入され、管理画面の保存で更新される
    """
    setting = session.get(CampaignSetting, 1)
    return setting if setting is not None else CampaignSetting(id=1)


@dataclass
class Slot:
    """登録者の枠の状態"""

    position: int  # 登録順の番号（1始まり）
    limit: int
    within_limit: bool  # 枠内かどうか
    remaining: int  # 残り枠


def position_of(session: Session, user: User) -> int:
    """登録順の番号。自分より前に作られたユーザー数 + 1。

    users.id は連番なので id で数える。作成日時ではなく id を使うのは、
    同一秒に複数登録された場合でも順序が一意に決まるため
    """
    earlier = session.exec(
        select(func.count()).select_from(User).where(User.id < user.id)
    ).one()
    return int(earlier) + 1


def slot_of(session: Session, user: User) -> Slot:
    position = position_of(session, user)
    limit = get_settings(session).slot_limit
    total = int(session.exec(select(func.count()).select_from(User)).one())
    return Slot(
        position=position,
        limit=limit,
        within_limit=position <= limit,
        remaining=max(0, limit - total),
    )


def remaining_slots(session: Session) -> int:
    """LPに出す残り枠。未ログインでも見せられるよう、ユーザー個別の情報を持たない"""
    total = int(session.exec(select(func.count()).select_from(User)).one())
    return max(0, get_settings(session).slot_limit - total)


def granted_count(session: Session) -> int:
    """報酬を付与済みの人数。枠の判定はこの数で行う。

    登録者数ではなく付与済み数で数えるのは、キャンペーン開始前に登録した
    ユーザーが枠を消費しないようにするため
    """
    return int(
        session.exec(
            select(func.count())
            .select_from(User)
            .where(User.campaign_reward_granted_at.is_not(None))
        ).one()
    )


def grant_reward(session: Session, user: User) -> bool:
    """枠が残っていれば報酬を付与する。付与したら True。

    ⚠️ 同時登録が重なると枠を数人超えることがある。行ロックで完全に
       防ぐこともできるが、そうしない理由が2つある。

       1. 交換の開放は10/1で、その前に管理画面で対象を確定させる運用のため、
          付与時点での厳密さが要らない（超過分は開放前に取り消せる）
       2. 超過しても数人・数十ソルの話で、ロックによる登録の詰まりの方が損失が大きい

       二重付与だけは確実に防ぐ（campaign_reward_granted_at で判定）。
    """
    if user.campaign_reward_granted_at is not None:
        return False
    settings = get_settings(session)
    if granted_count(session) >= settings.slot_limit:
        return False

    user.points += settings.reward_points
    user.campaign_reward_granted_at = dt.datetime.now(dt.timezone.utc)
    session.add(user)
    logger.info(
        "campaign reward granted: user=%s points=%s",
        user.id,
        settings.reward_points,
    )
    return True


def withdrawals_open_at(session: Session) -> dt.date | None:
    """換金の開放日。未設定（NULL）なら None ＝ 即座に開放"""
    return get_settings(session).withdrawals_open_at


def withdrawals_open(session: Session, today: dt.date | None = None) -> bool:
    opens = withdrawals_open_at(session)
    if opens is None:
        return True
    return (today or dt.datetime.now(dt.timezone.utc).date()) >= opens
