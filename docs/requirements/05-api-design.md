# API設計（FastAPI on Heroku）

## 設計の基本方針

フロントエンドはDBに直接アクセスしない。**読み取りも書き込みもすべてFastAPI経由**で行い、お金が動く処理はDBトランザクションで守る。

| 操作 | 経路 | 備考 |
| --- | --- | --- |
| ログイン | NextAuth（Google）→ FastAPI `/auth/login` → 自前JWT発行 | FarmMatchパターン |
| ポイント・換金履歴の表示 | フロントエンド → FastAPI → Heroku Postgres | 自前JWTで本人確認し、自分のデータだけ返す |
| 報酬付与（Postback） | Monlix → FastAPI → Heroku Postgres | 二重付与防止・署名検証はサーバー側で実施 |
| 換金申請 | フロントエンド → FastAPI → Heroku Postgres | ポイントチェックと差し引きをアトミックに行う |
| 換金処理（送金完了・却下） | 管理者が `/admin/withdrawals` から実行 → FastAPI → Heroku Postgres | 却下時のポイント返還・ステータス更新・監査ログを1トランザクションで行う |

## 認証（FarmMatchパターン + IDトークン検証）

1. フロントエンドでNextAuth.js（Google Provider）がGoogleログインを処理する
2. NextAuthのコールバックで得た**GoogleのIDトークン**（`account.id_token`）を `POST /api/v1/auth/login` に送る
3. FastAPIはGoogleの公開鍵でIDトークンを検証し（`google-auth` ライブラリ、audience = 自分のGOOGLE_CLIENT_ID）、`sub` / `email` / `name` / `picture` を取り出す
4. `users` をUPSERTし、**自前JWT**（jose / HS256、`sub` = users.id）を発行して返す
5. フロントエンドはNextAuthのセッションに自前JWTを保持し、以降のAPI呼び出しに `Authorization: Bearer <jwt>` を付ける

> FarmMatchとの差分: FarmMatchはフロントから送られたGoogleプロフィールをそのまま信頼していたが、本アプリはお金を扱うため**IDトークンのサーバー側検証を必須**にする。`auth_service.py`（JWT発行・検証）はそのまま流用できる。

- JWTの有効期限は `ACCESS_TOKEN_EXPIRE_MINUTES` で設定（MVPは7日 = 10080分。期限切れ時はNextAuthセッションが生きていれば自動で `/auth/login` を再実行して再取得）
- Postbackエンドポイントのみ認証方式が異なる（後述のシークレット検証）

## エンドポイント一覧

| メソッド | パス | 認証 | 用途 |
| --- | --- | --- | --- |
| GET | `/health` | なし | Herokuのヘルスチェック |
| POST | `/api/v1/auth/login` | GoogleのIDトークン | ユーザーのUPSERTと自前JWTの発行 |
| GET | `/api/v1/me` | 自前JWT | 自分のプロフィール・所持ポイント取得 |
| GET | `/api/v1/withdrawals` | 自前JWT | 自分の換金申請履歴の取得 |
| POST | `/api/v1/withdrawals` | 自前JWT | 換金申請の作成 |
| GET | `/api/v1/offers` | 自前JWT | 案件一覧の取得（CPALead。subidはサーバー側で自分のIDを入れる） |
| GET/POST | `/api/v1/admin/*` | 自前JWT＋`is_admin` | 管理画面用。ルーター単位で `require_admin` を付け、個別に書かせない |
| GET | `/postback/monlix` | Postbackシークレット | Monlixからの成果通知受信 |
| GET / POST | `/postback/cpalead` | 送信元IP＋Postbackシークレット | CPALeadからの成果通知受信 |
| GET | `/dev/mock/cpalead/*` | なし | CPALeadのモック。`CPALEAD_MOCK=true` のときだけ登録される |

---

### POST `/api/v1/auth/login` — ログイン・ユーザー登録

**リクエスト**

```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

**処理**

1. GoogleのIDトークンを検証（署名・有効期限・audience）
2. `google_id`（= `sub`）で `users` をUPSERT:

```sql
INSERT INTO users (google_id, email, name, avatar_url)
VALUES (:sub, :email, :name, :picture)
ON CONFLICT (google_id) DO UPDATE SET name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url;
```

3. 自前JWTを発行して返す

**レスポンス（200）**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

| 失敗 | ステータス |
| --- | --- |
| IDトークンが不正・期限切れ | 401 `INVALID_GOOGLE_TOKEN` |

---

### GET `/api/v1/me` — 自分の情報と所持ポイント

Home画面のヘッダー（所持ポイント・プログレスバー）とWallet画面のポイント表示に使う。

**レスポンス（200）**

```json
{
  "id": 123,
  "email": "user@example.com",
  "name": "Juan Pérez",
  "avatar_url": "https://...",
  "points": 250,
  "min_withdrawal_points": 500,
  "points_per_sol": 100
}
```

`min_withdrawal_points` と `points_per_sol` を含めるのは、フロントエンドがプログレスバー・申請ボタンの活性制御・ソル換算プレビューに使うため（値をフロントにハードコードしない）。

---

### GET `/api/v1/withdrawals` — 換金申請履歴

Wallet画面の履歴一覧に使う。自分の申請のみ、作成日時の降順で返す。

**レスポンス（200）**

```json
{
  "withdrawals": [
    {
      "id": "b7e2...",
      "yape_phone": "987654321",
      "points": 1000,
      "amount_soles": "10.00",
      "status": "pending",
      "created_at": "2026-07-22T10:00:00Z"
    }
  ]
}
```

---

### POST `/api/v1/withdrawals` — 換金申請の作成

**リクエスト**

```json
{
  "yape_phone": "987654321",
  "points": 1000
}
```

**バリデーション**

| ルール | 失敗時 |
| --- | --- |
| `yape_phone` は9桁の数字で `9` 始まり（ペルーの携帯番号形式） | 422 `INVALID_PHONE` |
| `points >= 500`（最低換金ポイント = S/ 5相当） | 422 `BELOW_MINIMUM` |
| `points` が `POINTS_PER_SOL`（100）の倍数（端数ソルを発生させない） | 422 `INVALID_AMOUNT` |
| `points <= users.points` | 422 `INSUFFICIENT_POINTS` |
| 同一ユーザーの `pending` 申請が存在しない | 409 `WITHDRAWAL_ALREADY_PENDING` |

**処理**（1トランザクションで実行。ポイントは**申請時に差し引く**。`amount_soles = points / POINTS_PER_SOL`）

```
BEGIN;
SELECT points FROM users WHERE id = :user_id FOR UPDATE;  -- 行ロックで並行申請を防ぐ
-- ポイントチェック
UPDATE users SET points = points - :points WHERE id = :user_id;
INSERT INTO withdrawals (user_id, yape_phone, points, amount_soles, status)
  VALUES (..., 'pending');
COMMIT;
```

**レスポンス（201）**

```json
{
  "id": "b7e2...",
  "yape_phone": "987654321",
  "points": 1000,
  "amount_soles": "10.00",
  "status": "pending",
  "created_at": "2026-07-22T10:00:00Z"
}
```

---

### GET `/postback/monlix` — 成果通知の受信

Monlixが成果発生時に呼び出すサーバー間通信。MonlixのPostbackはクエリパラメータ付きGETリクエスト。

**クエリパラメータ**（Monlix管理画面のPostback URL設定でマクロを割り当てる）

| パラメータ | 例 | 説明 |
| --- | --- | --- |
| `userid` | `123` | 成果を上げたユーザーのID（`users.id`）。iframe埋め込み時に渡した値がそのまま返る |
| `transaction_id` | `mlx_abc123` | Monlix側の一意の取引ID。冪等性キー |
| `amount` | `500` | ユーザーに付与するポイント数（整数。Monlixダッシュボードの仮想通貨単位） |
| `status` | `1` | 成果の状態（承認 = 1） |
| `hash` | `a3f9...` | 署名（下記の検証方法参照） |

**検証（正当性チェック）** — 上から順に実施し、失敗したら付与しない

1. **署名検証**: Monlixが提供するSecret Keyを使ったハッシュ（`hash`パラメータ）を検証する。方式はMonlixのPostback仕様に従う（契約後に確定）
2. **IP制限（任意）**: Monlixが公開するPostback送信元IPをホワイトリスト化できる場合は併用する
3. **`userid` の存在チェック**: `users` に該当行がなければ404
4. **`transaction_id` の重複チェック**: `postbacks.transaction_id` のUNIQUE制約により、INSERT時の一意性違反で検出する

**処理**（1トランザクションで実行）

```
BEGIN;
INSERT INTO postbacks (transaction_id, user_id, reward_points) VALUES (...);
  -- UNIQUE違反なら → ロールバックし 200 を返す（Monlixに再送させない）
UPDATE users SET points = points + :points WHERE id = :userid;
COMMIT;
```

**レスポンス**

| 状況 | ステータス | 備考 |
| --- | --- | --- |
| 付与成功 | 200 | ボディは `OK` などMonlix仕様に従う |
| transaction_id重複（再送） | 200 | 冪等。すでに処理済みなので成功として返し再送を止める |
| 署名不正 | 403 | 付与しない。ログに記録 |
| userid不明 | 404 | 付与しない。ログに記録 |

---

### エラーレスポンス共通形式

```json
{
  "error": {
    "code": "INSUFFICIENT_POINTS",
    "message": "Puntos insuficientes"
  }
}
```

`message` はユーザー表示用にスペイン語。`code` はフロントエンドの分岐用。

## 換金申請のライフサイクルとポイントの動き

```
申請時:    points から消費ポイントを差し引き、withdrawals に pending で保存
completed: 管理者がYape送金後、/admin/withdrawals で「承認」
           → status を completed に更新（ポイント操作なし。申請時に差し引き済みのため）
rejected:  管理者が /admin/withdrawals で「却下」
           → points を返還 + status を rejected に更新 + admin_logs に記録（1トランザクション）
```

`POST /api/v1/admin/withdrawals/{id}/approve` ／ `/reject`。どちらも対象を `FOR UPDATE` で取得し、**すでに終端状態なら409 `ALREADY_PROCESSED`** で弾く（二重送金・二重返還の防止）。

> 以前はこの2つの更新をDBクライアントから手動SQLで行う想定だったが、却下時に `UPDATE users` を打ち忘れるとユーザーの残高が消えるため、管理画面の1操作にまとめた（[04-decisions.md](./04-decisions.md)）。

ポイントを申請時に差し引く理由: 差し引かないと、`pending` 中にポイントを使い回して二重申請できてしまう。「pending申請は1件まで」の制約と合わせて二重出金を防ぐ。

## シーケンス図

### ログイン〜報酬付与フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant FE as Next.js (Vercel)
    participant G as Google OAuth
    participant M as Monlix
    participant API as FastAPI (Heroku)
    participant DB as Heroku Postgres

    U->>FE: Googleでログイン（NextAuth）
    FE->>G: OAuth認可フロー
    G-->>FE: GoogleのIDトークン
    FE->>API: POST /api/v1/auth/login {id_token}
    API->>API: Google公開鍵でIDトークン検証
    API->>DB: users をUPSERT
    API-->>FE: 自前JWT
    FE->>M: iframe表示（URLに users.id を付与）
    U->>M: iframe内でタスク完了
    M->>API: GET /postback/monlix?userid=..&transaction_id=..&amount=..&hash=..
    API->>API: 署名検証
    API->>DB: INSERT postbacks + UPDATE users.points（1トランザクション）
    API-->>M: 200 OK
    U->>FE: 画面更新
    FE->>API: GET /api/v1/me（JWT付き）
    API-->>FE: points
    FE-->>U: ポイント表示が増える
```

### 換金申請フロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant FE as Next.js (Vercel)
    participant API as FastAPI (Heroku)
    participant DB as Heroku Postgres
    participant Ad as 管理者

    U->>FE: /wallet でYape番号と換金ポイントを入力
    FE->>API: POST /api/v1/withdrawals（JWT付き）
    API->>API: JWT検証・バリデーション
    API->>DB: points差し引き + withdrawals作成（1トランザクション）
    API-->>FE: 201 pending
    Ad->>DB: DBクライアントで pending を確認
    Ad->>Ad: Yapeアプリで手動送金
    Ad->>DB: status を completed に更新
    U->>FE: /wallet を開く
    FE->>API: GET /api/v1/withdrawals
    API-->>FE: 履歴
    FE-->>U: 「送金完了（Pagado）」表示
```

## 環境変数

### バックエンド（FastAPI / Heroku）

| 変数名 | 内容 |
| --- | --- |
| `DATABASE_URL` | Heroku Postgresの接続文字列（Herokuがアドオン追加時に自動設定） |
| `SECRET_KEY` | 自前JWTの署名鍵（FarmMatchの `auth_service.py` と同じ） |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWTの有効期限（分）。MVPは `10080`（7日） |
| `GOOGLE_CLIENT_ID` | GoogleのIDトークン検証時のaudienceチェック用 |
| `MONLIX_POSTBACK_SECRET` | Postback署名検証用（Monlix契約後に取得） |
| `POINTS_PER_SOL` | 換金レート。デフォルト `100`（100 pts = S/ 1） |
| `MIN_WITHDRAWAL_POINTS` | 最低換金ポイント。デフォルト `500`（= S/ 5） |

### フロントエンド（Next.js / Vercel）

| 変数名 | 内容 |
| --- | --- |
| `NEXTAUTH_URL` | アプリのURL（開発: `http://localhost:3000`） |
| `NEXTAUTH_SECRET` | NextAuthのセッション暗号化鍵 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuthクライアント（NextAuthのProvider設定用） |
| `NEXT_PUBLIC_API_URL` | FastAPIのURL（開発: `http://localhost:8000`、本番: HerokuアプリのURL） |

## 契約後に確定させる事項（TODO）

- [ ] Monlixダッシュボードの**Virtual Currency設定**: Currency Name（例: Coins）とExchange Rate（例: 1 USD = 1,000 Coins）を設定し、iframe内をポイント表示にする
- [ ] MonlixのPostback署名方式（ハッシュアルゴリズムとパラメータ順）
- [ ] Monlix iframeのURL形式と `userid` の渡し方（サブID用パラメータ名）
- [ ] Monlixの報酬通貨（USDで来る場合はS/への換算レートと換算タイミング）
- [ ] Postback送信元IPのホワイトリスト可否
- [ ] Monlixの署名検証を「シークレット未設定なら検証をスキップ」から「未設定なら付与しない」へ揃える（CPALead側は対応済み。`server/routers/postback.py` の `verify_postback_hash`）

### CPALead（実装はモックで先行。契約後に実値へ差し替える）

差し替えが必要な箇所は2つに閉じ込めてある。

- [ ] **オファーJSONのキー名と型** → `server/services/cpalead_service.py` の `_normalize()`
- [ ] **ポストバックのマクロ名** → `server/routers/postback.py` の `P_*` 定数
- [ ] **署名方式**（対象パラメータと連結順） → `CPALeadService.signature_payload()`
- [ ] **ステータス値の対応** → `CPALEAD_STATUS_MAP`（現状 0=未承認 / 1=承認 / 2=否認 を仮定）
- [ ] **報酬の通貨単位**（USDのみか、Virtual Currency設定でポイント建てにできるか）と `CPALEAD_USD_TO_POINTS` の値
- [ ] **期待レスポンス**（現状は既存Monlix実装に揃えて403/404/422を返す。常時200を返しボディの値で結果を区別する仕様の提供元もある）
- [ ] **送信元IP** → `CPALEAD_ALLOWED_IPS`。未設定のまま `CPALEAD_MOCK=false` にすると全て拒否される
- [ ] **オファーリンクにカスタムパラメータを引き回せるか**（`digest` によるsubid改ざん検知が使えるかの判断材料）
