# デプロイ手順

本番構成: web（Next.js）→ **Vercel** ／ server（FastAPI）+ DB → **Heroku**（GitHub Educationクレジット）。本番ではDockerを使わず、各プラットフォームの標準ビルドに任せる。

## 事前準備

- [ ] GitHub EducationでHerokuの学生特典を有効化（Herokuアカウントと紐付け）
- [ ] Heroku CLIをインストール（`brew install heroku/brew/heroku`）して `heroku login`
- [ ] Vercelアカウント（GitHubログイン）
- [ ] Google OAuthクライアント作成済み（[05-api-design.md](./05-api-design.md) の環境変数参照）

## 1. Heroku（server + DB）

モノレポのため、`server/` ディレクトリだけを `git subtree` でHerokuにpushする方式を使う。

```bash
# アプリ作成（リージョンはus。名前は例）
heroku create papunto-api

# Postgresアドオン追加（Essential-0。1万行上限に注意、増えたらessential-1へ）
heroku addons:create heroku-postgresql:essential-0 -a papunto-api
# → DATABASE_URL が自動で設定される

# 環境変数
heroku config:set -a papunto-api \
  SECRET_KEY=$(openssl rand -hex 32) \
  ACCESS_TOKEN_EXPIRE_MINUTES=10080 \
  GOOGLE_CLIENT_ID=<GoogleのクライアントID> \
  POINTS_PER_SOL=100 \
  MIN_WITHDRAWAL_POINTS=500 \
  FRONTEND_ORIGIN=https://<vercelのドメイン>
# MONLIX_POSTBACK_SECRET はMonlix契約後に設定

# デプロイ（リポジトリルートから。server/ だけをpush）
git subtree push --prefix server heroku main

# 確認
curl https://papunto-api-<hash>.herokuapp.com/health
```

- `server/Procfile` が `uvicorn main:app --port $PORT` を起動する
- Pythonバージョンは `server/.python-version`（3.12）で指定
- マイグレーションはProcfileの `release: alembic upgrade head` によりデプロイごとに自動適用される

### 2回目以降のデプロイ

```bash
git subtree push --prefix server heroku main
```

コンフリクト等でpushが拒否された場合: `git push heroku $(git subtree split --prefix server main):main --force`

## 2. Vercel（web）

1. https://vercel.com/new でGitHubの `kervint1/papunto` をインポート
2. **Root Directory を `web` に設定**（モノレポのため必須）
3. Framework Preset: Next.js（自動検出）
4. 環境変数を設定:

| 変数 | 値 |
| --- | --- |
| `NEXTAUTH_URL` | `https://<vercelのドメイン>` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` で生成（開発用とは別の値） |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Consoleの値 |
| `NEXT_PUBLIC_API_URL` | HerokuアプリのURL（例: `https://papunto-api-xxx.herokuapp.com`） |

5. Deploy実行

## 3. デプロイ後の接続設定

- [ ] Google Cloud Console → OAuthクライアント → 承認済みリダイレクトURIに `https://<vercelのドメイン>/api/auth/callback/google` を追加
- [ ] Herokuの `FRONTEND_ORIGIN` をVercelの本番ドメインに更新（CORS用）
- [ ] 動作確認: 本番URLでGoogleログイン → /home表示 → /walletでポイント0表示
- [ ] 管理者運用: TablePlus等で `heroku config:get DATABASE_URL -a papunto-api` の接続文字列を使ってHeroku Postgresに接続

## 4. Monlix接続時（契約後）

- [ ] Postback URL: `https://papunto-api-xxx.herokuapp.com/postback/monlix?userid={subid}&transaction_id={tid}&amount={amount}&status={status}&hash={hash}`（マクロ名はMonlix仕様に合わせる）
- [ ] `heroku config:set MONLIX_POSTBACK_SECRET=...`
- [ ] `server/routers/postback.py` の `verify_postback_hash` をMonlixの署名仕様に合わせて実装
- [ ] `NEXT_PUBLIC_MONLIX_IFRAME_URL` をVercelに設定
