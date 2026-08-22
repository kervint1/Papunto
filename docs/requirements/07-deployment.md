# デプロイ手順

本番構成:

| | デプロイ先 | リポジトリ |
| --- | --- | --- |
| web（Next.js） | **Vercel**（Root Directory = `web`） | `papunto` |
| server（FastAPI）+ DB | **Heroku**（GitHub Educationクレジット） | `papunto` の `server/` |
| メディア pandia（Next.js） | **Vercel** | `papunto-pandia`（別リポジトリ） |
| 記事の画像 | **Appwrite Storage** | — |

ドメインは `papunto.pe` を **www に寄せている**（apex → www へ308リダイレクト）。メディアは本体の `/blog` 配下としてリライトで配信し、ドメイン評価を統合している。

## デプロイの流れ

**`main` へのpushで自動デプロイされる。** Heroku・Vercelとも GitHub 連携済みで、`git subtree push` は不要。

```
main へ push
  ├→ GitHub Actions（CI: pytest / 型チェック / ビルド）
  ├→ Heroku（server）      … release フェーズで alembic upgrade head
  ├→ Vercel（web）
  └→ Vercel（pandia）※別リポジトリ
```

Herokuの Deploy 設定にある **「Wait for GitHub checks to pass before deploy」を有効にする**と、CIが通ったものだけが本番に出る。

### モノレポの扱い

Herokuは buildpack を2段で使い、`server/` だけを切り出している。

```
1. https://github.com/lstoll/heroku-buildpack-monorepo   ← APP_BASE=server
2. heroku/python
```

`APP_BASE` はこのbuildpack用の設定なので消さないこと。

## 環境変数

### Heroku（server）

| 変数 | 値 | 未設定だとどうなるか |
| --- | --- | --- |
| `DATABASE_URL` | アドオンが自動設定 | — |
| `SECRET_KEY` | `openssl rand -hex 32` | 既定の開発用鍵が使われる（危険） |
| `GOOGLE_CLIENT_ID` | Google Cloud Consoleの値 | ログインの検証に失敗する |
| `FRONTEND_ORIGIN` | `https://www.papunto.pe` | **CORSで全APIがブロックされる** |
| `APP_BASE` | `server` | ビルドが失敗する |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | 既定7日 |
| `POINTS_PER_SOL` / `MIN_WITHDRAWAL_POINTS` | `100` / `500` | 既定値 |
| `RELOADLY_CLIENT_ID` / `RELOADLY_CLIENT_SECRET` | Reloadlyの値 | **携帯チャージが502で失敗する** |
| `RELOADLY_SANDBOX` | `false` | サンドボックスに繋がる |
| `CPALEAD_MOCK` | `false` | **架空の案件が本番に出る**（既定true） |
| `PUBLIC_BASE_URL` | HerokuアプリのURL | CPALEAD_MOCK=false なら未使用 |
| `APPWRITE_ENDPOINT` | `https://nyc.cloud.appwrite.io/v1` | リージョン不一致で全操作が失敗する |
| `APPWRITE_PROJECT_ID` / `APPWRITE_API_KEY` / `APPWRITE_BUCKET_ID` | Appwriteの値 | **画像がdyno再起動で消える**（下記） |
| `MONLIX_POSTBACK_SECRET` | Monlix契約後 | 署名検証をスキップし誰でも付与できる |
| `SMTP_HOST` / `SMTP_USER` | `smtp.resend.com` / `resend` | **マジックリンクと登録完了メールが送れない** |
| `SMTP_PASSWORD` | ResendのAPIキー（`re_...`） | 同上 |
| `MAIL_FROM` | `Papunto <noreply@papunto.pe>` | 差出人がSMTP_USERになる。Resendで認証したドメインと一致させること |
| `RESEND_WEBHOOK_SECRET` | Resendの `whsec_...` | 配信結果のWebhookが全て403。**不達に気づけなくなる** |
| `RESEND_API_KEY` | ResendのAPIキー | バウンスしたアドレスへ再送できない（抑制を外せないため）|
| `MAGIC_LINK_DEV_ECHO` | **設定しない** | 既定false。trueにするとログを見た人が誰でもログインできる |

> **キャンペーンの設定（枠数・報酬・交換の開放日）は環境変数ではない。**
> DBの `campaign_settings` に持ち、管理画面 **/admin/campaign** から変える。
> キャンペーン中に何度も触る値で、環境変数だと変更のたびに設定変更と再起動が要るため。
> 初期値（100枠 / 500pt / 2026-10-01）はマイグレーション `e6f1a4c92b38` が投入する。
> 変更は `admin_logs` に before/after 付きで残る。

### Vercel（web / Root Directory = `web`）

| 変数 | 値 |
| --- | --- |
| `NEXTAUTH_URL` | `https://www.papunto.pe`（**Production のみ**。Previewに付けるとプレビューの認証が本番へ飛ぶ） |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Consoleの値 |
| `NEXT_PUBLIC_API_URL` | HerokuアプリのURL |
| `NEXT_PUBLIC_SITE_URL` | `https://www.papunto.pe`（**未設定だとcanonical/sitemapがlocalhostを指す**） |
| `MEDIA_URL` | pandiaのVercel URL（未設定だと `/blog` が404） |

> `NEXT_PUBLIC_` の変数はクライアントのJSに埋め込まれ誰でも見られる。Sensitive を付けても秘匿されないので、そこに秘密を入れない。

### Vercel（pandia）

| 変数 | 値 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://www.papunto.pe`（**本体のドメイン**。ここにpandia自身のVercel URLを入れるとcanonicalが分散する） |
| `API_URL` | HerokuアプリのURL（未設定だと記事が0件のまま） |

> pandiaのプロジェクトに `papunto.pe` を**追加してはいけない**。リライトで配信されるため、ドメインは本体プロジェクトにだけ紐付ける。

## Appwrite Storage（記事の画像）

未設定でも動くが、**サーバーのローカルディスクに保存される**。Herokuのファイルシステムは揮発性で、**デプロイや再起動のたびに画像が消える**ため本番では必ず設定する。

1. Appwriteコンソールでプロジェクトを作成 → **Project ID** を控える
   - リージョンは **NYC** を推奨（ペルーのユーザーにもHerokuのUSリージョンにも近い）
   - **リージョンごとにエンドポイントが違う。** `APPWRITE_ENDPOINT` を必ず設定する
     （NYC: `https://nyc.cloud.appwrite.io/v1`。未設定だと既定のFRA向けを見にいき
     `Project is not accessible in this region` で失敗する）
2. Storage → バケット作成
   - **`APPWRITE_BUCKET_ID` には「Bucket ID」を入れる**（表示名ではない。自動生成だと
     ランダムな文字列になる。間違えると `bucket ... could not be found`）
   - **Permissions で Any に Read を付ける**（付けないと画像が表示されない）
   - File security は**オフ**（オンにするとファイル個別の権限が優先され、全ファイルが読めなくなる）
3. API Key を作成し、Scopes に **`files.read` / `files.write`** を付ける
4. Herokuに3つを設定

どちらで動いているかは管理画面の `/api/v1/admin/uploads/config` の `backend` で確認できる（`appwrite` / `local`）。

## Google OAuth

Google Cloud Console → OAuthクライアントに追加する。

- 承認済みリダイレクトURI: `https://www.papunto.pe/api/auth/callback/google`
- 承認済みJavaScript生成元: `https://www.papunto.pe`

**未設定だと `redirect_uri_mismatch` でログインできない。**

## 初回のみ必要な作業

**管理者フラグ** — 管理画面は `users.is_admin` で入室を判定する。画面からは昇格させられないので、対象のユーザーが一度ログインした後にDBを直接更新する。

```bash
heroku pg:psql -a papunto-api \
  -c "UPDATE users SET is_admin = true WHERE email = '<メールアドレス>';"
```

`psql` が無ければ Heroku ダッシュボードの **More → Run console** で `python` を開き、`models.User` を更新してもよい。

## 反映確認

```bash
curl -s https://papunto-api-52f69be08ffb.herokuapp.com/health
# 署名なしなので403が正常。404ならデプロイされていない
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://papunto-api-52f69be08ffb.herokuapp.com/webhooks/resend -d "{}"
curl -s https://www.papunto.pe/robots.txt
curl -s https://www.papunto.pe/ | grep -o 'rel="canonical"[^>]*'
curl -s -o /dev/null -w "%{http_code}\n" https://www.papunto.pe/blog
```

`canonical` が `https://www.papunto.pe` を指し、`/blog` が200なら繋がっている。

## ローカル開発

```bash
docker compose up          # web:3001 / server:8000 / db:5432
```

メディアは別リポジトリなので個別に起動する。

```bash
cd ../papunto-pandia && API_URL=http://localhost:8000 npm run dev   # :3002/blog
```

> ⚠️ **devサーバーを動かしたまま `next build` を実行しないこと。** `.next` が本番ビルドの成果物で上書きされ、アセットが404になって画面が壊れる。ビルドの検証はCIに任せる。復旧は `.next` を削除してdevサーバーを再起動する。

> ⚠️ **本番DBをローカルから使わないこと。** 実ユーザーのポイント残高・換金申請・個人情報に直接影響し、マイグレーションのミスが本番を壊す。

> 依存を追加したら、コンテナ内にも入れる（`docker compose exec web npm install` / `docker compose exec server pip install -r requirements-dev.txt`）。`node_modules` が匿名ボリュームのため、ホスト側の `npm install` だけでは反映されない。
