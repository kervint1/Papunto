import os

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/papunto"
)
# Heroku は postgres:// 形式で渡してくるが SQLAlchemy は postgresql:// を要求する
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

MONLIX_POSTBACK_SECRET = os.getenv("MONLIX_POSTBACK_SECRET", "")

# 自サーバーの公開URL。モックのオファーURL・クリックページの組み立てに使う
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000")

# --- CPALead（オファーウォール。契約前はモックで通しの動作を確認する） ---
CPALEAD_MOCK = os.getenv("CPALEAD_MOCK", "true").lower() in ("1", "true", "yes")
CPALEAD_API_KEY = os.getenv("CPALEAD_API_KEY", "")
CPALEAD_POSTBACK_SECRET = os.getenv("CPALEAD_POSTBACK_SECRET", "")
# 許可する送信元IP（カンマ区切り）。契約後にCPALeadのダッシュボードで確認して設定する
CPALEAD_ALLOWED_IPS = [ip.strip() for ip in os.getenv("CPALEAD_ALLOWED_IPS", "").split(",") if ip.strip()]
CPALEAD_USD_TO_POINTS = int(os.getenv("CPALEAD_USD_TO_POINTS", "300"))

# モック時だけ開発用の既定値を入れる。こうしておくと本番（CPALEAD_MOCK=false）で
# 設定漏れがあった場合に「検証をスキップして誰でも付与できる」ではなく
# 「検証に失敗して付与しない」という安全側に倒れる
if CPALEAD_MOCK:
    CPALEAD_API_KEY = CPALEAD_API_KEY or "mock-cpalead-api-key"
    CPALEAD_POSTBACK_SECRET = CPALEAD_POSTBACK_SECRET or "mock-cpalead-postback-secret"

CPALEAD_API_BASE = (
    f"{PUBLIC_BASE_URL}/dev/mock/cpalead" if CPALEAD_MOCK
    else "https://www.cpalead.com/api"
)

# 1件の成果で付与できるポイントの上限。
# 報酬額はポストバックのペイロードをそのまま信じており、署名対象にも含まれないうえ、
# サーバー側に期待額を持つ仕組みもない。上流のバグ・桁誤り・テストデータの本番混入による
# 異常付与を検知して遮断する防御層として設ける（実際の単価から十分マージンを取った値）
MAX_REWARD_POINTS = int(os.getenv("MAX_REWARD_POINTS", "100000"))

# ポイント制: 現金額を直接持たず整数ポイントで管理する（規約対応）
POINTS_PER_SOL = int(os.getenv("POINTS_PER_SOL", "100"))          # 100 pts = S/ 1（1pt = 1céntimo）
MIN_WITHDRAWAL_POINTS = int(os.getenv("MIN_WITHDRAWAL_POINTS", "500"))  # = S/ 5

# --- 事前登録キャンペーン ---
# 枠数・報酬・交換の開放日はここには無い。**DBの campaign_settings** に持ち、
# 管理画面（/admin/campaign）から変える。キャンペーン中に何度も触る値で、
# 環境変数だと変更のたびに Heroku の設定変更と再起動が要るため。
# 既定値は models/campaign_setting.py を参照

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

# --- Facebookログイン ---
# papunto-sns（Instagram投稿）と同じMetaアプリを使ってよい。
# ⚠️ APP_SECRET は必須。これが無いとトークンが「うちのアプリ向けに発行された
#    ものか」を確かめられず、他アプリのトークンで他人になりすませる
META_APP_ID = os.getenv("META_APP_ID", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")
META_API_VERSION = os.getenv("META_API_VERSION", "v23.0")
META_GRAPH_BASE = f"https://graph.facebook.com/{META_API_VERSION}"

# --- メール送信（マジックリンクのログイン） ---
# 提供元はResend（smtp.resend.com / ユーザー名は固定文字列 "resend"）。
# ホストとユーザー名を定数にしていないのは、無料枠（100通/日）を超えたときに
# BrevoやSESへ**環境変数だけで**切り替えられるようにするため
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
MAIL_FROM = os.getenv("MAIL_FROM", "")

# ⚠️ 開発用。true にすると**メールを送らずログにリンクを出す**。
#    本番で有効にするとログを見られる人が誰でもログインできる
MAGIC_LINK_DEV_ECHO = os.getenv("MAGIC_LINK_DEV_ECHO", "false").lower() in ("1", "true", "yes")

# 配信結果のWebhook（Resendのダッシュボードで発行する `whsec_...`）。
# ⚠️ 未設定だと署名検証が**必ず失敗**し、Webhookは全て403で拒否される。
#    「未設定なら検証をスキップ」にしていないのは、誰でも任意のアドレスを
#    ブロックできる＝任意のユーザーのログインを妨害できてしまうため
RESEND_WEBHOOK_SECRET = os.getenv("RESEND_WEBHOOK_SECRET", "")

# 抑制リストの解除に使うAPIキー。SMTP_PASSWORD と同じ値でも動くが、
# 送信だけの権限しか無いキーだと DELETE /suppressions が失敗するので分けてある。
# 未設定でも送信は動く（解除ができなくなるだけ）
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")

# Reloadly: ポイント→携帯キャリア（Claro/Movistar/Entel/Bitel）チャージ交換
RELOADLY_CLIENT_ID = os.getenv("RELOADLY_CLIENT_ID", "")
RELOADLY_CLIENT_SECRET = os.getenv("RELOADLY_CLIENT_SECRET", "")
RELOADLY_SANDBOX = os.getenv("RELOADLY_SANDBOX", "true").lower() in ("1", "true", "yes")

RELOADLY_AUTH_URL = "https://auth.reloadly.com/oauth/token"
RELOADLY_API_BASE = (
    "https://topups-sandbox.reloadly.com" if RELOADLY_SANDBOX
    else "https://topups.reloadly.com"
)

# Appwrite Storage: 記事のアイキャッチ画像の保管先
# （GitHub Student PackのPro相当を利用。技術スタックの当初想定どおり）
APPWRITE_ENDPOINT = os.getenv("APPWRITE_ENDPOINT", "https://cloud.appwrite.io/v1")
APPWRITE_PROJECT_ID = os.getenv("APPWRITE_PROJECT_ID", "")
APPWRITE_API_KEY = os.getenv("APPWRITE_API_KEY", "")
APPWRITE_BUCKET_ID = os.getenv("APPWRITE_BUCKET_ID", "papunto-media")

# 受け付ける画像の上限と種類。管理者しか触らない経路だが、
# 画像以外を投げられる口は塞いでおく
# ローカル保存の置き場所（Appwrite未設定のときに使う開発用）。
# Herokuのファイルシステムは揮発性なので本番では必ずAppwriteを設定すること
LOCAL_UPLOAD_DIR = os.getenv("LOCAL_UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "uploads"))

UPLOAD_MAX_BYTES = int(os.getenv("UPLOAD_MAX_BYTES", str(5 * 1024 * 1024)))
UPLOAD_ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
