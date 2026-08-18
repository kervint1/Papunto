from typing import Optional

from pydantic import BaseModel


class ReferralMe(BaseModel):
    """自分の招待状況。招待画面に出す"""

    code: str
    share_url: str  # そのままWhatsAppに貼れる形にして返す
    reward_points: int  # 1件成立あたりの報酬
    total: int  # 紐づいた人数
    settled: int  # 成立した人数
    earned_points: int  # これまでに得たポイント
    max_per_user: int
    # 成立の条件は時期で変わるので、画面の文言を出し分けるために返す
    settles_on_registration: bool

    # --- 招待された側としての状態 ---
    # 誰に招待されたか。未招待なら None
    invited_by: Optional[str] = None
    # コードを手入力できる状態か。
    # ⚠️ リンク経由（?ref=）はWhatsAppのアプリ内ブラウザで壊れる。
    #    Googleはアプリ内WebViewでのOAuthを拒否するため外部ブラウザに移り、
    #    localStorageに保存したコードが失われる。手入力がその迂回路になる
    can_claim: bool = False


class ReferralClaim(BaseModel):
    code: str


class ReferralClaimResult(BaseModel):
    claimed: bool
    inviter_name: Optional[str] = None


class ReferralCheck(BaseModel):
    """ログイン前のコード確認。**認証不要**。

    登録の前に「ちゃんと友達に入るのか」を確かめられるようにするため。
    確かめずに登録させると、不安なまま進ませることになる。
    """

    valid: bool
    # 下の名前だけ返す。誰でも叩ける経路なので、コードを知っているだけの
    # 相手にフルネームまで見せない
    inviter_name: Optional[str] = None
