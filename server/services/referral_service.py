"""招待（リファラル）。

広告の代わりの集客経路。Meta広告は200円で見知らぬ人に1回表示されるだけだが、
友達招待は同じ200円で友達が実際に登録し、紹介者の信用も乗る。
ペルーはWhatsApp中心なので、この差が特に大きい。

## 成立は「招待された人がタスクで一定額を稼いだとき」

登録した時点で成立させると、**メールアドレスを10個作って自分で自分を招待するだけ**で
報酬が積み上がる。マジックリンクのログインがあるので、電話番号もGoogleアカウントも
要らない。メールは無料で無限に作れる。

タスクの実績を条件にすると、成立ごとに**本物のASPの成果**が要る。つまり
farming をやるほど**こちらの売上も増える**ので、攻撃が自滅する。

件数ではなく獲得ポイントで見る。件数だと一番安い案件を並べるだけで済むため。

⚠️ 数えるのは**タスクの報酬だけ**。キャンペーン報酬や招待報酬は数えない。
   あれはこちらの支出であって、収益ではない。

⚠️ 招待された人に何も強制はしない。待つのは招待した側の報酬だけ。

⚠️ Notionの当初案は「招待された側が3タスク完了で成立」だったが、その3タスクに
   「友達を1人招待」が含まれており循環していた（AはBの3タスク完了待ち、Bの
   タスクにはCの…と無限に遡る）。成立条件から招待自体を外して解消している。

## 不正対策

自作自演（複数アカウントで自分を招待する）を止めているのは `users.phone` の
UNIQUE制約であって、ここのロジックではない。報酬はポイントで即時に付くが、
現金になるのは電話番号の登録を経た換金だけなので、**金が出る前に必ず
一意性の検査を通る**。この順序がキャンペーン本体と同じ考え方。
"""
import datetime as dt
import logging
import secrets

from sqlmodel import Session, func, select

from models import Referral, User
from services import campaign_service, points_service

logger = logging.getLogger(__name__)

# 招待コードの文字集合。WhatsAppや口頭で伝え間違えないよう
# 紛らわしい文字（0/O、1/I/L）を外している
_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
CODE_LENGTH = 8

# 登録からこの期間を過ぎた人には招待コードを適用しない。
# 後から遡って紐づけられると、既存ユーザーを「招待した」ことにできてしまう
CLAIM_WINDOW = dt.timedelta(days=7)


def _generate_code() -> str:
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(CODE_LENGTH))


def ensure_code(session: Session, user: User) -> str:
    """招待コードを返す。未発行なら発行する。

    全員に配らず初回アクセス時に作るのは、使わない人の分まで
    コード空間を消費しないため
    """
    if user.referral_code:
        return user.referral_code

    for _ in range(5):
        code = _generate_code()
        if session.exec(select(User).where(User.referral_code == code)).first() is None:
            user.referral_code = code
            session.add(user)
            session.commit()
            session.refresh(user)
            return code
    # 31^8 の空間で5回続けて衝突するのは実質ありえないが、
    # 無限ループにはしない
    raise RuntimeError("招待コードの発行に失敗した（衝突が続いた）")


def task_earnings(session: Session, user: User) -> int:
    """タスクで稼いだポイントの合計。

    ⚠️ kind="offer" だけを数える。キャンペーン報酬や招待報酬はこちらの支出で、
       収益ではないため
    """
    from models import PointTransaction

    return int(
        session.exec(
            select(func.coalesce(func.sum(PointTransaction.points), 0)).where(
                PointTransaction.user_id == user.id,
                PointTransaction.kind == "offer",
            )
        ).one()
    )


def is_settled_condition_met(session: Session, invitee: User) -> bool:
    """招待された人がタスクで規定額を稼いでいれば成立"""
    required = campaign_service.get_settings(session).referral_required_earnings
    return task_earnings(session, invitee) >= required


def settled_count(session: Session, inviter: User) -> int:
    return int(
        session.exec(
            select(func.count())
            .select_from(Referral)
            .where(Referral.inviter_user_id == inviter.id)
            .where(Referral.settled_at.is_not(None))
        ).one()
    )


def total_count(session: Session, inviter: User) -> int:
    return int(
        session.exec(
            select(func.count())
            .select_from(Referral)
            .where(Referral.inviter_user_id == inviter.id)
        ).one()
    )


def earned_points(session: Session, inviter: User) -> int:
    return int(
        session.exec(
            select(func.coalesce(func.sum(Referral.reward_points), 0)).where(
                Referral.inviter_user_id == inviter.id
            )
        ).one()
    )


def first_name(user: User) -> str | None:
    """表示用の下の名前。

    ログイン前の確認は誰でも叩けるので、フルネームまでは出さない
    """
    if not user.name:
        return None
    return user.name.strip().split()[0]


def find_by_code(session: Session, raw_code: str) -> User | None:
    code = raw_code.strip().upper()
    if not code:
        return None
    return session.exec(select(User).where(User.referral_code == code)).first()


def invited_by(session: Session, user: User) -> User | None:
    """自分を招待した人。未招待なら None"""
    referral = session.exec(
        select(Referral).where(Referral.invitee_user_id == user.id)
    ).first()
    if referral is None:
        return None
    return session.get(User, referral.inviter_user_id)


def within_claim_window(user: User) -> bool:
    created = user.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=dt.timezone.utc)
    return dt.datetime.now(dt.timezone.utc) - created <= CLAIM_WINDOW


def try_settle(session: Session, referral: Referral) -> bool:
    """条件を満たしていれば成立させ、招待元に報酬を付ける。付けたら True。

    commitはしない。呼び出し元のトランザクションに載せることで、
    「ポイントは増えたのに成立時刻が入っていない」状態を作らない
    """
    if referral.settled_at is not None:
        return False

    invitee = session.get(User, referral.invitee_user_id)
    if invitee is None or not is_settled_condition_met(session, invitee):
        return False

    settings = campaign_service.get_settings(session)
    inviter = session.get(User, referral.inviter_user_id)
    if inviter is None:
        return False

    # 上限は成立済みの件数で数える。紐づいただけの件数で数えると、
    # 成立しない招待を並べるだけで枠を塞げてしまう
    if settled_count(session, inviter) >= settings.referral_max_per_user:
        logger.info(
            "referral over limit: inviter=%s limit=%s",
            inviter.id,
            settings.referral_max_per_user,
        )
        return False

    points = settings.referral_reward_points
    inviter.points += points
    referral.settled_at = dt.datetime.now(dt.timezone.utc)
    referral.reward_points = points
    session.add(inviter)
    session.add(referral)
    points_service.record(
        session,
        user=inviter,
        points=points,
        kind="referral",
        reference_type="referral",
        reference_id=referral.id,
        note=f"Invitaste a {first_name(invitee) or "un amigo"}",
    )
    logger.info(
        "referral settled: inviter=%s invitee=%s points=%s",
        inviter.id,
        invitee.id,
        points,
    )
    return True


def settle_for_invitee(session: Session, invitee: User) -> bool:
    """招待された側の状況が変わったときに、成立を試す。

    **成果が承認されたとき**に呼ぶ（成立条件がタスクの実績のため）
    """
    referral = session.exec(
        select(Referral).where(Referral.invitee_user_id == invitee.id)
    ).first()
    if referral is None:
        return False
    return try_settle(session, referral)


class ReferralError(Exception):
    """招待の適用に失敗した理由。ルーターが ApiError に変換する"""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def claim(session: Session, invitee: User, raw_code: str) -> Referral:
    """招待コードを適用して、招待元と紐づける。

    条件を満たせばその場で成立させる（事前登録の期間中は登録＝成立のため）
    """
    code = raw_code.strip().upper()
    if not code:
        raise ReferralError("INVALID_CODE", "Código de invitación inválido")

    # 1人が招待されるのは1回だけ。付け替えも許さない
    existing = session.exec(
        select(Referral).where(Referral.invitee_user_id == invitee.id)
    ).first()
    if existing is not None:
        raise ReferralError("ALREADY_INVITED", "Ya usaste un código de invitación")

    # 後から遡って紐づけられると、既存ユーザーを「招待した」ことにできる
    if not within_claim_window(invitee):
        raise ReferralError(
            "CLAIM_WINDOW_CLOSED",
            "El código solo se puede usar al crear la cuenta",
        )

    inviter = session.exec(select(User).where(User.referral_code == code)).first()
    if inviter is None:
        raise ReferralError("CODE_NOT_FOUND", "Código de invitación inválido")
    if inviter.id == invitee.id:
        raise ReferralError("SELF_REFERRAL", "No puedes usar tu propio código")

    referral = Referral(
        inviter_user_id=inviter.id,
        invitee_user_id=invitee.id,
        code=code,
    )
    session.add(referral)
    session.flush()  # 成立判定でこの行を参照するため先に採番する
    try_settle(session, referral)
    session.commit()
    session.refresh(referral)
    logger.info("referral claimed: inviter=%s invitee=%s", inviter.id, invitee.id)
    return referral
