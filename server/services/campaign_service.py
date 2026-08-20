"""事前登録キャンペーン。

先着順は **登録順（users.id の昇順）** で決まる。Googleログインだけで
番号が確定するので、電話番号やタスクを求めずに「あなたは37人目です」と
即座に返せる。摩擦を最小にして登録数を最大化するための設計。

## 付与は3段階

    登録          → 枠を確保するだけ。**ポイントは0**
    電話番号登録  → 300pt
    タスク1件     → +200pt（合計500pt＝最低交換額）

**登録しただけでは1ptも存在しない。** 登録時に付与していた頃は、
メールアドレスを大量に作るだけで盗めるものが生まれていた
（マジックリンクのログインがあるので電話番号もGoogleアカウントも要らない）。
電話番号を条件にすると、1件ごとに実在のSIMが1枚要る。

300ptは最低交換額（500pt）に届かない。タスクを1件こなさないと1ソルも
引き出せないので、交換の開放日に引き出して終わりにならない。
ASPに見せる成果の実績にもなる。

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
from services import points_service

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
    同一秒に複数登録された場合でも順序が一意に決まるため。

    ⚠️ **除外したアカウントは数えない。** 管理者や検証用のアカウントを
       数えると、最初の実ユーザーが「#3 de 100」と表示される。
       1人しか登録していないのに3番目では、希少性の話が成立しない
    """
    earlier = session.exec(
        select(func.count())
        .select_from(User)
        .where(User.id < user.id, User.campaign_excluded == False)  # noqa: E712
    ).one()
    return int(earlier) + 1


def slot_of(session: Session, user: User) -> Slot:
    position = position_of(session, user)
    limit = get_settings(session).slot_limit
    return Slot(
        position=position,
        limit=limit,
        within_limit=position <= limit,
        remaining=remaining_slots(session),
    )


def remaining_slots(session: Session) -> int:
    """LPに出す残り枠。未ログインでも見せられるよう、ユーザー個別の情報を持たない。

    ⚠️ **確保済み件数**で数える。付与済みで数えると、登録はしたが電話番号を
       まだ入れていない人が枠を消費していないことになり、実態とずれる。
       不正を見つけたら確保ごと取り消せば枠が戻る
    """
    return max(0, get_settings(session).slot_limit - reserved_count(session))


def reserved_count(session: Session) -> int:
    """枠を確保した人数。**枠の判定はこの数で行う**。

    付与済み数では数えない。付与は電話番号の登録時なので、そちらで数えると
    「登録は100人いるのに残り枠は100のまま」になり、希少性の表示が壊れる
    """
    return int(
        session.exec(
            select(func.count())
            .select_from(User)
            .where(
                User.campaign_reserved_at.is_not(None),
                User.campaign_excluded == False,  # noqa: E712
            )
        ).one()
    )


def granted_count(session: Session) -> int:
    """報酬を付与済みの人数。運用の把握用（枠の判定には使わない）"""
    return int(
        session.exec(
            select(func.count())
            .select_from(User)
            .where(
                User.campaign_reward_granted_at.is_not(None),
                User.campaign_excluded == False,  # noqa: E712
            )
        ).one()
    )


def reserve_slot(session: Session, user: User) -> bool:
    """先着枠を確保する。確保できたら True。**ポイントは渡さない**。

    登録した時点で呼ぶ。付与は電話番号の登録まで待つ（grant_reward）。

    ⚠️ 同時登録が重なると枠を数人超えることがある。行ロックで完全に防ぐ
       こともできるが、超過しても数人の話で、ロックによる登録の詰まりの方が
       損失が大きい。二重確保だけは確実に防ぐ。
    """
    if user.campaign_reserved_at is not None:
        return False
    if user.campaign_excluded or user.is_admin:
        return False
    if reserved_count(session) >= get_settings(session).slot_limit:
        return False

    user.campaign_reserved_at = dt.datetime.now(dt.timezone.utc)
    session.add(user)
    logger.info("campaign slot reserved: user=%s", user.id)
    return True


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
    # 枠を確保していない人には付与しない（枠外の登録、除外したアカウント）
    if user.campaign_reserved_at is None:
        return False
    if user.campaign_excluded:
        return False
    settings = get_settings(session)

    user.points += settings.reward_points_initial
    user.campaign_reward_granted_at = dt.datetime.now(dt.timezone.utc)
    session.add(user)
    # 台帳に残す。ここを書かないと「理由の分からない300pt」になる。
    # 付与額を台帳に持つことで、後で報酬額を変えても過去分を復元できる
    points_service.record(
        session,
        user=user,
        points=settings.reward_points_initial,
        kind="campaign",
        note="Bono de pre-registro",
    )
    logger.info(
        "campaign reward granted: user=%s points=%s",
        user.id,
        settings.reward_points_initial,
    )
    return True


def revoke_reward(session: Session, user: User) -> int:
    """付与済みの報酬を取り消す。戻した合計ポイントを返す。

    取り消せないと、管理者や検証用のアカウントが埋めた枠が永久に戻らない。
    不正を見つけたときにも同じ経路を使う（残り枠は付与済み件数で数えているので、
    取り消せば枠が戻る）。

    ⚠️ 招待報酬は取り消さない。別の行為への報酬なので、キャンペーンの除外とは分ける。

    commitはしない（呼び出し元のトランザクションに載せる）
    """
    settings = get_settings(session)
    returned = 0

    # 確保も外す。外さないと枠が戻らない
    user.campaign_reserved_at = None
    if user.campaign_reward_granted_at is not None:
        returned += settings.reward_points_initial
        user.campaign_reward_granted_at = None
    if user.campaign_bonus_granted_at is not None:
        returned += settings.reward_points_bonus
        user.campaign_bonus_granted_at = None

    if returned == 0:
        session.add(user)
        return 0

    user.points -= returned
    session.add(user)
    # 履歴から消すのではなく「取り消した」として残す
    points_service.record(
        session,
        user=user,
        points=-returned,
        kind="campaign_revoked",
        note="Bono de pre-registro anulado",
    )
    logger.info("campaign reward revoked: user=%s points=%s", user.id, returned)
    return returned


def completed_tasks(session: Session, user: User) -> int:
    """こなしたタスクの件数。**承認された成果**だけを数える。

    未承認は残高に入っていないので数えない。数えると、承認されない成果を
    大量に発生させるだけでボーナスを取れてしまう。

    TODO: 独自タスク（アンケート等）が入ったら、その完了もここに足す
    """
    from models import Postback  # 循環importを避けるため関数内で読む

    return int(
        session.exec(
            select(func.count())
            .select_from(Postback)
            .where(Postback.user_id == user.id, Postback.status == "approved")
        ).one()
    )


def bonus_progress(session: Session, user: User) -> tuple[int, int]:
    """(こなした件数, 必要な件数)。画面の進捗表示に使う"""
    settings = get_settings(session)
    return completed_tasks(session, user), settings.bonus_required_tasks


def try_grant_bonus(session: Session, user: User) -> bool:
    """タスクを規定数こなしていたら残りの報酬を付ける。付けたら True。

    commitはしない（呼び出し元のトランザクションに載せる）。

    ⚠️ 初回分を受け取っていない人には付けない。枠外で登録した人が
       タスクだけこなしてボーナスを取る、という穴を塞ぐため
    """
    if user.campaign_reward_granted_at is None:
        return False
    if user.campaign_bonus_granted_at is not None:
        return False
    if user.campaign_excluded:
        return False

    settings = get_settings(session)
    if settings.reward_points_bonus <= 0:
        return False
    if completed_tasks(session, user) < settings.bonus_required_tasks:
        return False

    user.points += settings.reward_points_bonus
    user.campaign_bonus_granted_at = dt.datetime.now(dt.timezone.utc)
    session.add(user)
    points_service.record(
        session,
        user=user,
        points=settings.reward_points_bonus,
        kind="campaign_bonus",
        note="Bono por completar tareas",
    )
    logger.info(
        "campaign bonus granted: user=%s points=%s",
        user.id,
        settings.reward_points_bonus,
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
