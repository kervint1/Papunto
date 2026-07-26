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

# ポイント制: 現金額を直接持たず整数ポイントで管理する（規約対応）
POINTS_PER_SOL = int(os.getenv("POINTS_PER_SOL", "100"))          # 100 pts = S/ 1（1pt = 1céntimo）
MIN_WITHDRAWAL_POINTS = int(os.getenv("MIN_WITHDRAWAL_POINTS", "500"))  # = S/ 5

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
