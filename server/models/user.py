from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    # ログイン手段。"google" | "facebook" | "email"
    #
    # ⚠️ 一意なのは (provider, provider_user_id) の組。provider_user_id 単独では
    #    別プロバイダ間で衝突しうる（同じ文字列を別のIDとして使う保証がない）
    provider: str = Field(default="google", index=True)
    provider_user_id: str = Field(index=True)  # Googleならsubクレーム
    # メールは本人の同一性の判断材料になるので一意のままにする。
    # 同じメールで別プロバイダから来たら、新規作成せず既存に紐づける
    email: str = Field(unique=True)
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    # Yapeの送金先。登録は任意だが、登録済みの番号は一意。
    #
    # ログイン時には求めない（先に求めると詐欺と思われて離脱する）。
    # タスクの実行と換金の手前で登録させる。
    #
    # ⚠️ UNIQUEは不正対策の要。Googleアカウントは無料で無限に作れるので、
    #    ここが無いと同じ人が複数アカウントで報酬を何度も受け取れる。
    #    招待機能はこの制約の上でしか成立しない
    phone: Optional[str] = Field(default=None, unique=True, index=True)
    points: int = Field(default=0)  # 所持ポイント（現金額は持たない）
    # 招待コード。共有リンクに載る文字列なので、口頭やWhatsAppで
    # 伝え間違えないよう紛らわしい文字（0/O, 1/I/L）を除いた8文字にする。
    # 初回に /referral/me を叩いた時点で発行する（全員に配らない）
    referral_code: Optional[str] = Field(default=None, unique=True, index=True)
    # 先着枠を確保した時刻。**枠の判定はこれで行う**。
    #
    # 付与（campaign_reward_granted_at）と分けているのは、登録した時点では
    # ポイントを渡さないため。登録だけで付与すると、メールアドレスを大量に
    # 作るだけで盗めるものが生まれる（マジックリンクがあるので電話番号も
    # Googleアカウントも要らない）。
    campaign_reserved_at: Optional[datetime] = Field(default=None, index=True)
    # 事前登録キャンペーンの報酬を付与した時刻。
    # 二重付与を防ぐためと、誰が対象になったかを後から追えるようにするため
    # ⚠️ 付与は**電話番号を登録したとき**。登録時ではない
    campaign_reward_granted_at: Optional[datetime] = Field(default=None, index=True)
    # 残りの200ptを付与した時刻。タスクを規定数こなすと入る。
    # 分けて持つのは「登録しただけの人」と「実際に動いた人」を区別するため
    campaign_bonus_granted_at: Optional[datetime] = Field(default=None, index=True)
    # 事前登録キャンペーンの対象外にする。管理者や検証用のアカウントが
    # 先着100名の枠を消費しないようにするためのフラグ。
    #
    # ⚠️ is_admin では代用できない。管理者フラグは**登録の後に**付けるので、
    #    その時点では既に付与が済んでいる。除外は明示的に持つ
    campaign_excluded: bool = Field(default=False, index=True)
    # 登録完了メールを送った時刻。二重送信を防ぐ。
    # ⚠️ 送信の成否で判断しない。送れなかったときに記録すると、二度と送れなくなる
    welcome_email_sent_at: Optional[datetime] = Field(default=None)
    # 管理画面の利用可否。
    #
    # ⚠️ 昇格・降格は管理画面から行えるが、**自分自身は変更できない**。
    #    管理者セッションを奪われたときに管理者を増やして居座られるのが
    #    元々の懸念なので、操作は必ず admin_logs に残す。
    is_admin: bool = Field(default=False, index=True)
    # 退会した時刻。**物理削除はしない**。
    #
    # ポイントの台帳や成果の記録が外部キーで刺さっており、消すと会計が壊れる。
    # 代わりに個人が特定できる値（メール・氏名・アバター・電話番号）を落とし、
    # UNIQUE制約を空けて再登録できるようにする。
    deleted_at: Optional[datetime] = Field(default=None, index=True)
    # 凍結した時刻。**削除とは用途が違う**。
    #
    #   削除  個人情報を落とす。本人の請求と、Google Play の要件に応える
    #   凍結  アカウントは残したまま使わせない。規約9条の「停止」がこれ
    #
    # 削除だと別のメールアドレスで戻ってこられるので、不正対策としては弱い。
    # 逆に削除請求には凍結では応じられない（個人情報が残るため）。
    suspended_at: Optional[datetime] = Field(default=None, index=True)
    # 退会時に電話番号のハッシュだけ残す。番号そのものは消す。
    #
    # ⚠️ これが無いと「退会 → 再登録」で事前登録の300ptを何度でも受け取れる。
    #    電話番号はキャンペーンの不正対策の土台なので、番号を消しても
    #    「この番号は受給済み」という事実だけは残す必要がある。
    #    ハッシュにはサーバー側の秘密（SECRET_KEY）を混ぜるので、
    #    DBだけ漏れても総当たりで番号は復元できない
    phone_hash: Optional[str] = Field(default=None, index=True)
    # 枠の期限が近いことを知らせたメールを送った時刻。二重送信を防ぐ。
    # ⚠️ 送信の成否で判断しない。送れなかったときに記録すると二度と送れない
    reservation_reminder_sent_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
