# 開発環境（Docker）

`docker compose up` 一発で、フロントエンド（`npm run dev`）・バックエンド（uvicorn `--reload`）・開発用Postgresが同時に起動する構成にする。

## 決定事項

| 項目 | 決定内容 |
| --- | --- |
| 起動方法 | `docker compose up` のみ。個別に `npm run dev` や `uvicorn` を叩かない |
| 開発用DB | composeに **postgres コンテナ** を含める（本番がHeroku Postgres = 素のPostgresなので、ローカルも素のPostgresで挙動が一致する。FarmMatchの開発環境と同じ方式） |
| 認証 | NextAuth.js + Google OAuthクライアント（開発用にリダイレクトURI `http://localhost:3000` を登録） |
| ホットリロード | ソースをバインドマウントし、Next.jsのFast Refresh / uvicornの `--reload` を使う |
| コンテナ | `web`（Node 22）、`server`（Python 3.12）、`db`（postgres:16）の3つ |
| ポート | フロントエンド 3000、バックエンド 8000、DB 5432 |

## ディレクトリ構成

全体構成は [FarmMatch](https://github.com/kervint1/FarmMatch) を踏襲する（FarmMatchのfrontend/backendに相当するものを web/ + server/ と命名。serverはrouters/models/schemas/servicesの分け方）。

```
papunto/
├── docker-compose.yml
├── .env                  # compose が読む環境変数（gitignore対象）
├── .env.example          # 必要な変数の一覧（コミットする）
├── web/             # Next.js
│   ├── Dockerfile.dev
│   ├── app/              # App Router（page.tsx, login/, home/, wallet/）
│   │   └── api/auth/[...nextauth]/  # NextAuthルートハンドラ
│   ├── components/
│   ├── hooks/
│   ├── lib/              # api.ts（FastAPI呼び出し）、auth.ts（NextAuth設定）
│   └── package.json ほか
├── server/              # FastAPI（構成はFarmMatchと同様）
│   ├── Dockerfile.dev
│   ├── main.py
│   ├── database.py
│   ├── models/           # SQLModel定義（user, postback, withdrawal）
│   ├── schemas/          # Pydanticスキーマ
│   ├── routers/          # auth, me, withdrawals, postback
│   ├── services/         # auth_service（FarmMatchから流用）ほか
│   └── requirements.txt
└── docs/
```

## docker-compose.yml

```yaml
services:
  web:
    build:
      context: ./web
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./web:/app
      - /app/node_modules        # ホストのnode_modulesで上書きしない
    env_file: .env               # NEXTAUTH_* / GOOGLE_* を渡す
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
      API_URL_INTERNAL: http://server:8000   # NextAuthコールバック(サーバー側)からのAPI呼び出し用
      NEXTAUTH_URL: http://localhost:3000
    command: npm run dev

  server:
    build:
      context: ./server
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    volumes:
      - ./server:/app
    env_file: .env               # SECRET_KEY / GOOGLE_CLIENT_ID などを渡す
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/papunto
      POINTS_PER_SOL: "100"
      MIN_WITHDRAWAL_POINTS: "500"
      ACCESS_TOKEN_EXPIRE_MINUTES: "10080"
    depends_on:
      db:
        condition: service_healthy
    command: sh -c "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"              # DBクライアント(TablePlus等)からも繋げる
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: papunto
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 3s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

ポイント:

- `NEXT_PUBLIC_API_URL` が `http://localhost:8000` なのは、FastAPIを呼ぶのが**ブラウザ**だから（コンテナ間通信ではない）
- `server` から見たDBホスト名は `db`（composeのサービス名）
- `/app/node_modules` の匿名ボリュームで、ホスト側（macOS）とコンテナ側（Linux）のネイティブモジュール差異を回避する
- `db` のhealthcheckにより、Postgresが受付可能になってからserverが起動する

## web/Dockerfile.dev

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
```

## server/Dockerfile.dev

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

## .env.example

```bash
# --- Google OAuth（NextAuth用。Google Cloud ConsoleでOAuthクライアントを作成） ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- NextAuth ---
# openssl rand -base64 32 で生成
NEXTAUTH_SECRET=

# --- バックエンド ---
# 自前JWTの署名鍵。openssl rand -hex 32 で生成
SECRET_KEY=
# Monlix契約後に設定。それまでは空でよい
MONLIX_POSTBACK_SECRET=
```

`.env` は gitignore し、`.env.example` をコミットする。`DATABASE_URL` はcompose内で固定しているため `.env` に書く必要はない（本番はHerokuが自動設定）。

## テーブルの初期化・マイグレーション（Alembic）

テーブルの作成・変更は**Alembic**（`server/alembic/`）で管理する。composeの`server`は起動前に `alembic upgrade head` を自動実行するため、`docker compose up` すれば常に最新スキーマになる。

スキーマを変更するときの手順:

```bash
# 1. server/models/ のSQLModelを編集
# 2. マイグレーションを自動生成
docker compose exec server alembic revision --autogenerate -m "add xxx column"
# 3. 生成された server/alembic/versions/*.py を目視確認
# 4. 適用（再起動でも可）
docker compose exec server alembic upgrade head
```

## 日常の開発フロー

| やりたいこと | コマンド |
| --- | --- |
| 開発開始 | `docker compose up`（初回は自動でビルドされる） |
| バックグラウンド起動 | `docker compose up -d` → ログは `docker compose logs -f` |
| 停止 | `Ctrl+C` または `docker compose down` |
| DBを初期化からやり直す | `docker compose down -v`（ボリュームごと削除） |
| npmパッケージ追加 | `docker compose exec web npm install <pkg>` → 次回のために `docker compose build web` |
| pipパッケージ追加 | `requirements.txt` に追記 → `docker compose build server` → 再起動 |
| 開発DBをGUIで見る | TablePlus等で `localhost:5432 / postgres / postgres / papunto` に接続 |

ソースコードの変更はバインドマウント経由で即座に反映される。**再ビルドが必要なのは依存関係が変わったときだけ。**

## 本番との対応関係

| 環境 | フロントエンド | バックエンド | DB | 認証 |
| --- | --- | --- | --- | --- |
| 開発（ローカル） | Docker `web` | Docker `server` | Docker `db`（postgres:16） | Google OAuthクライアント（localhost用リダイレクトURI） |
| 本番 | Vercel | Heroku | Heroku Postgres | 同じOAuthクライアント（本番URLのリダイレクトURIを追加） |

本番はDockerを使わない（Vercel / Herokuの標準ビルドに任せる）。Dockerは開発環境の統一のためだけに使う。

## Monlix Postbackのローカル検証

Postbackは外部（Monlix）からの着信なので、ローカル開発中は `localhost:8000` に自動では届かない。検証方法:

1. **手動curl**（普段はこれで十分）:
   `curl "http://localhost:8000/postback/monlix?userid=..&transaction_id=test1&amount=1.50&hash=.."`
2. **トンネル**（Monlixとの疎通確認時のみ）: `ngrok http 8000` などで一時URLを発行し、Monlix側のPostback URLに設定する
