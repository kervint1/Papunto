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
    # 管理画面の利用可否。昇格は画面から行わずDBクライアントで直接UPDATEする
    # （管理画面が乗っ取られても管理者を増やされないようにするため）
    is_admin: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
