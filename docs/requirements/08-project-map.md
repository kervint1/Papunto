# プロジェクト全体像

新しく入る人（人間・AI問わず）が最初に読む地図。**4つのリポジトリの関係**と
**外部サービスの契約状態**、そして**コードを読んでも分からない決定の理由**を書く。

各論は `00`〜`07` にある。ここは「どこに何があるか」と「なぜそうなっているか」に絞る。

> 最終更新: 2026-08-21

---

## 1. Papuntoとは

**ペルー向けのポイ活サービス。** スペイン語のみ。日本のモッピー／ポイントインカムに近い。

```
ユーザーがタスクをこなす（アンケート・アプリ登録・ゲーム）
        ↓
ASP（広告主のとりまとめ役）から成果報酬が入る   ← これが売上
        ↓
その一部をポイントとしてユーザーに返す
        ↓
ユーザーはポイントを Yape（ペルーの送金アプリ）で現金化する
```

**売上はASPからの成果報酬だけ。** ユーザーからは1円も取らない。

### なぜペルーか

- スマホ決済（Yape）の普及率が高く、**銀行口座がなくても現金を受け取れる**
- 日本と比べてポイ活サービスがほぼ無い
- 開発者にペルーとの縁がある

### 立ち上げの状況

**2026年10月1日リリース予定。** それまでは事前登録キャンペーン（先着100名）を回している。
9月時点では**タスクが1件も無い**ので、登録した人にはアプリを見せていない（後述）。

---

## 2. ポイント経済

| | 値 | 定義場所 |
| --- | --- | --- |
| レート | **100 pts = S/ 1.00** | `server/config.py` `POINTS_PER_SOL` |
| 最低交換額 | **500 pts = S/ 5.00** | `server/config.py` `MIN_WITHDRAWAL_POINTS` |
| 交換先 | Yape（現金） | `web/lib/exchangeDestinations.ts` |

1 pt = 1 céntimo。**S/ 5.00 は日本円でおよそ200円**。金額感を掴んでおくと、
不正対策の議論で「そこまでやる価値があるか」を判断しやすい。

### ポイント台帳

`point_transactions` テーブルが**すべての増減を記録する**。

```
不変条件:  sum(point_transactions.points) == users.points
```

`users.points` を直接いじってはいけない。必ず `services/points_service.py` の
`record()` を通す。履歴に出ない増減があると、後から差分の原因を追えなくなる。

---

## 3. 4つのリポジトリ

すべて `github.com/kervint1/` の下にある。**モノレポではない。**

```
                    ┌──────────────────────────────┐
                    │  papunto        （本体）       │
                    │  web/    Next.js  → Vercel    │
                    │  server/ FastAPI  → Heroku    │
                    └───────┬──────────────┬───────┘
                            │              │
              /blog をリライト │              │ APIを叩く
                            ▼              ▼
        ┌───────────────────────┐   ┌──────────────────────┐
        │ papunto-pandia        │   │ papunto-native       │
        │ メディアサイト(記事)     │   │ React Native / Expo  │
        │ Next.js → Vercel      │   │                      │
        └───────────────────────┘   └──────────────────────┘

        ┌───────────────────────┐
        │ papunto-sns           │   本体とは疎結合。APIを叩かない
        │ Instagram自動投稿      │   集客だけを担当
        │ Python → GitHub Actions│
        └───────────────────────┘
```

### papunto（本体）

| | |
| --- | --- |
| `web/` | Next.js 14 App Router + NextAuth。Vercel（Root Directory = `web`） |
| `server/` | FastAPI + SQLModel + Alembic。Heroku |
| `docs/requirements/` | 設計ドキュメント。**技術選定を調べるときはまずここ** |

DBは **Heroku Postgres Essential-0**。⚠️ **1万行の上限**がある。
`postback_logs` が一番伸びやすいので、古い行の削除運用かプラン変更がいずれ要る。

### papunto-pandia（メディアサイト）

SEO集客と**ASP審査対策**のための記事サイト。ペルー向けスペイン語で、
「ネットで収入を得る方法」「個人資産管理」といった記事を出す。

**独自ドメインでは公開しない。** 本体の `/blog` 配下として配信し、
ドメイン評価を本体に集約する。

```
ユーザー → papunto.pe/blog/...
              ↓ 本体 web/next.config.mjs の rewrites
           papunto-pandia.vercel.app/blog/...
```

- pandia 側は `basePath: "/blog"` を設定
- pandia の `NEXT_PUBLIC_SITE_URL` には**本体のドメイン**を入れる
  （自分のVercel URLを入れると canonical が分散する）
- 本体側の `MEDIA_URL` に pandia の Vercel URL を入れるとリライトが有効になる

⚠️ **記事は現在1本しかない**（`content/como-ganar-dinero-con-encuestas-en-peru.mdx`）。
ASP審査で実際に見られる場所なので、増やすのが優先タスクのひとつ。

### papunto-native（モバイルアプリ）

React Native / Expo（expo-router）。

**なぜ必要か:** オファーウォールの案件は**モバイルアプリのインストールが主体**で、
単価が高い。そしてASPのオファーウォールSDKは**ネイティブなのでWebViewに入らない**。
だから殻だけのWebViewアプリではなく、ネイティブで作っている。

APIクライアントは `orval` でサーバーのOpenAPIから生成する（`orval.config.ts`）。

### papunto-sns（Instagram自動投稿）

Googleドライブに置いた動画を、**1日1本Instagramリールへ自動投稿する**。

```
Googleドライブ「Unposted」  ← スマホから動画を放り込む
        │
        ▼  毎日1回（GitHub Actions）
   ① 未投稿の動画を1本取得（古い順）
   ② ファイル名からGeminiでキャプション＋ハッシュタグ生成
   ③ Instagramへバイナリを直接送信
   ④ 成功したものだけ「Posted」へ移動
```

**投稿済み判定はフォルダの位置がすべて。DBを持たない。** 失敗した動画は
`Unposted` に残るので次回自動的に再試行される。

フォロワー0の段階ではリンク投稿がほとんど配信されないため、
まずリールで新規に届けることを狙っている。

---

## 4. 外部サービス

### 契約済み・稼働中

| サービス | 用途 | 備考 |
| --- | --- | --- |
| **Heroku** | server のホスティング + Postgres | Essential-0。1万行上限 |
| **Vercel** | web と pandia のホスティング | |
| **Google OAuth** | ログイン | ⚠️ 後述の WebView 制約あり |
| **Appwrite Storage** | 記事画像などのアップロード先 | `services/appwrite_storage.py` |
| **punto.pe (RCP)** | `papunto.pe` の DNS | レジストラ自身のパネルで管理 |
| **ImprovMX** | `@papunto.pe` 宛の受信を個人Gmailへ転送 | 無料 |
| **Gemini API** | papunto-sns のキャプション生成 | |
| **Instagram Graph API** | papunto-sns の投稿 | 「Pandia SNS Bot」アプリ |

### 実装済み・未接続

| サービス | 用途 | 状態 |
| --- | --- | --- |
| **CPALead** | オファーウォール（案件供給） | **モック実装のみ**。`CPALEAD_MOCK=true` |
| **Monlix** | オファーウォール（別候補） | ポストバック受信だけ実装済み |
| **Reloadly** | 携帯リチャージへの交換 | **実装済みだが非公開**。`RELOADLY_SANDBOX=true` |
| **Facebook Login** | ログイン | コードは完成。Metaのビジネス認証待ちで App Secret が取れない |
| **Resend** | メール送信（SMTP） | 登録作業中 |

⚠️ **ASPが未契約なので、本番にタスクが1件も無い。** これが事業上の最大のボトルネック。
タスクが無いと成果も出ず、キャンペーンのボーナス200ptも招待報酬も成立しない。

### 触ってはいけないもの

**「Pandia SNS Bot」Meta アプリ**。papunto-sns の毎日の Instagram 投稿が
これに紐づいている。設定を変えると投稿が止まる。

---

## 5. 認証（3経路）

`server/routers/auth.py` と `web/lib/auth.ts`。
すべて `services/identity_service.py` の `resolve_user()` に集約される。

| 経路 | 状態 | 実装 |
| --- | --- | --- |
| Google | ✅ 稼働 | NextAuth の Google Provider |
| Facebook | ⏸ Metaのビジネス認証待ち | `services/facebook_service.py` |
| マジックリンク | ⏸ SMTP未設定 | `services/magic_link_service.py` |

### なぜマジックリンクが要るのか

**Googleは2021年から埋め込みWebViewでのOAuthを禁止している**（403 `disallowed_useragent`）。

```
Facebookのアプリ内ブラウザでリンクを開く
        ↓
Googleログインを押す
        ↓
403 disallowed_useragent   ← こちらでは直せない
```

集客をFacebookグループに頼る計画なので、**アプリ内ブラウザで動く経路が要る**。
それがマジックリンク。「あると便利」ではなく**必須の経路**。

### マジックリンクの安全側の作り

- トークンは **sha256 だけ保存**（平文を持たない）
- **15分で失効**、**1回だけ使える**
- レート制限 **10分に3回**

⚠️ `MAGIC_LINK_DEV_ECHO` を**本番で有効にしてはいけない**。メールを送らず
ログにリンクを出す開発用の仕組みなので、**Herokuのログを見られる人が
誰のアカウントにもログインできる**ようになる。

### identity_service の約束

```
⚠️ メールの所有確認が済んでいる手段だけをここに通すこと
```

`resolve_user()` は `(provider, provider_user_id)` で見つからないとき
**メールアドレスで既存ユーザーに紐付ける**。所有確認をしていない経路を
ここに通すと、他人のアカウントを乗っ取れる。

---

## 6. メール

現状は**受信と送信を分けている**。

```
受信   info@ / support@ / dev@ → ImprovMX → 個人Gmail    （無料・稼働中）
送信   noreply@papunto.pe → Resend                      （設定作業中）
```

**Google Workspace は契約していない。** 契約する必要もない。

### DNS の状態

```
MX     10 mx1.improvmx.com / 20 mx2.improvmx.com
SPF    v=spf1 include:spf.improvmx.com ~all
TXT    google-site-verification=...     ← Search Console。消さないこと
DKIM   未設定
DMARC  未設定
```

### 転送の落とし穴

**転送はDMARCを壊す。** 送信元が `p=reject` を設定していると、
転送されたメールは**受信側で拒否される**。

```
送信元(p=reject) → ImprovMX → Gmail
                      ↑
              ここで送信元IPが変わる
              → From: のドメインとアラインしない
              → DMARC失敗 → 捨てられる
```

いまのところ実害は出ていないが、**ASPの承認通知やMetaの警告**のような
落としたくないメールほどDMARCを厳格にしている。将来的には
実際のメールボックス（Zoho Mail の無料プランなど）へ寄せる判断がありうる。

---

## 7. 事前登録キャンペーン

**この設計には理由がある。読まずに変えないこと。**

### 何が起きるか

```
① アカウントを作る            → ポイントは入らない。枠だけ予約される
② 電話番号(Yape)を登録する     → 300 pt
③ 10/1にタスクを1件こなす      → 残り 200 pt
```

設定は `campaign_settings` テーブル（**常に1行だけ**、id=1）。
環境変数にしていないのは、**キャンペーン中に変える値だから**。
Herokuの設定変更は再起動を伴い、運用中に何度も触るには重い。

| 項目 | 既定値 |
| --- | --- |
| 枠数 | 100 |
| 登録時 | 300 pt |
| タスク後 | 200 pt |
| ボーナスに要るタスク | 1 件 |
| 招待報酬 | 200 pt |
| 招待の上限 | 1人あたり 10 件 |
| 招待成立に要る獲得額 | 招待された人が **500 pt** をタスクで稼ぐ |

### なぜ500ptを一度に渡さないのか

**一度に渡すと、10/1に引き出して離脱する。** 300ptは最低交換額（500pt）に
届かないので、**タスクを1件こなさないと1ソルも引き出せない**。
これが10/1に戻ってくる動機になる。

### なぜ招待の成立を「件数」でなく「獲得額」で見るのか

件数だと**一番安い案件を並べるだけ**で済んでしまう（案件は45ptから900ptまで幅がある）。
500ptは「友達が自力で交換できる所まで来たら報酬」という意味。

### なぜ事前登録中はアプリを見せないのか

**中にタスクが1件も無いから。** 空のアプリを見せると「登録したのに何もない」になる。
そのため `withdrawals_open` が false かつ枠を持っている間は、
`web/components/PreRegistroView.tsx` がアプリ全体を置き換える。

### 不正対策が成立している理由

```
アカウントを増やしても          → 登録だけではポイントが入らない
電話番号を増やしても            → Yapeは1つのDNIにつき1アカウント
                                → 同一人物は複数受け取れない
招待を自作自演しても            → 招待された側がタスクで500pt稼がないと成立しない
                                → 成立する頃にはこちらに売上が立っている
300ptだけ集めても              → 最低交換額500pt未満。引き出せない
```

**S/ 5.00（約200円）のために別人のDNIを用意する動機がない**というのが結論。
検知ツールを作る必要はないと判断済み。

⚠️ ただし **Yape以外の交換先（リチャージ、ギフトカード）を開けると
1DNI制約が効かなくなる**。開ける判断をするときはここを読み直すこと。

---

## 8. お金の流れ

```
ASP（CPALead / Monlix）
   │  成果が発生するとポストバックが飛ぶ
   ▼
POST /postback/{provider}     server/routers/postback.py
   │  ・署名検証（未設定なら拒否。素通りさせない）
   │  ・送信元IPの許可リスト
   │  ・生ペイロードを postback_logs に記録（成功も失敗も）
   │  ・上限ガード MAX_REWARD_POINTS
   ▼
users.points が増える + point_transactions に記録（同一トランザクション）
   ▼
ユーザーが500pt以上で交換申請     server/routers/withdrawals.py
   │  申請時点でポイントを差し引く
   ▼
管理画面に pending として並ぶ      web/app/admin/withdrawals/
   │
   ▼
⚠️ 管理者が Yape アプリで手動送金し、操作番号を入れて承認する
   （却下する場合はポイントを必ず返還する）
```

**送金は自動化されていない。** Yapeに法人向けAPIが無いため、
当面は管理者が手で送る。100人規模なら回るが、スケールすると詰まる。

---

## 9. いま動いていないもの

優先度の高い順。

1. **ASP未契約** — 本番にタスクが1件も無い。事業上の最大のボトルネック
2. **SMTP未設定** — マジックリンクと登録完了メールが本番で送れない
3. **Facebook Login** — Metaのビジネス認証待ち。コードは完成、env2つで動く
4. **ブログ記事** — 1本のみ。ASP審査で見られる
5. **Google Play** — 個人アカウントのため**テスター12人×14日**が必要
6. **ペルー個人データ保護法** — 域外適用あり。代表者指定とデータバンク登録が未対応

---

## 10. 運営体制

**運営主体は開発者の兄が代表を務める合同会社**（2026年8月に決定）。

| | |
| --- | --- |
| 対外的な運営主体 | 合同会社 |
| 実務（開発・運用） | 開発者本人（独立した事業者として） |
| **知的財産の帰属** | **開発者本人**（会社ではない） |
| 収益・経費 | 会社が受領・負担 |
| 業務委託料 | 事業余剰額の90%を開発者へ（四半期ごと） |

**なぜ法人にしたか:** ASP審査、Metaのビジネス認証（Facebook Login の前提）、
経費と会計の成立。

**なぜ知財を会社に移さないか:** 将来ペルー法人へ移管する予定があり、
法人所有になった資産を後から譲渡すると税務上は時価相当で扱われうるため。
最初から移さなければ買い戻しが発生しない。

契約書はNotionの「Papunto事業運営・業務委託・知的財産使用許諾契約書」にある。

### ペルーの個人データ保護法

**DS 016-2024-JUS（2025年3月30日施行）により域外適用がある。**
ペルー国内の人に向けてサービスを提供する国外事業者は Ley 29733 の対象。

**日本法人で運営しても対象になる**ので、法人をどこに置くかの判断とは独立している。

- ペルー向けの法的代表者の指定
- ANPD へのデータバンク登録（無料・自動承認）
- 侵害時は48時間以内に通知

---

## 11. 触るときの注意

### 禁止

- **`.env` を読まない。** シークレット（`GOOGLE_CLIENT_SECRET`、`SECRET_KEY`、
  `NEXTAUTH_SECRET`、`MONLIX_POSTBACK_SECRET` 等）が入っている。
  設定を確認したいときは `.env.example` を見るか、本人に聞く
- **`MAGIC_LINK_DEV_ECHO` を本番に入れない**
- **「Pandia SNS Bot」Metaアプリを触らない**（毎日のInstagram投稿が止まる）
- **開発サーバーが動いている状態で同じディレクトリに `next build` をしない**

### 気をつける

- `users.points` を直接更新しない。`points_service.record()` を通す
- ポストバックの署名シークレットが未設定なら**拒否する**。素通りさせない
  （素通りさせると誰でもポイントを付与できる）
- `campaign_settings.withdrawals_open_at` を意図せず NULL にすると
  **事前登録中でも交換できてしまう**
- Heroku Postgres は**1万行上限**。ログ系テーブルの伸びに注意

### ローカル開発

```bash
docker compose up      # alembic upgrade head が自動で走る
docker compose exec server pytest
```

`web` は `localhost:3001`、`server` は `localhost:8000`。
`CPALEAD_MOCK=true` のとき `/dev/mock/cpalead/...` が生えて、
案件クリックから成果発生までブラウザだけで一周できる。

---

## 12. どこを読むか

| 知りたいこと | 場所 |
| --- | --- |
| 画面の一覧 | `01-screens.md` |
| 技術選定の理由 | `02-tech-stack.md` |
| テーブル定義 | `03-data-model.md` |
| 過去の意思決定 | `04-decisions.md` |
| APIエンドポイント | `05-api-design.md` |
| ローカル環境 | `06-dev-environment.md` |
| デプロイ手順・環境変数 | `07-deployment.md` |
| タスクと期限 | Notion「タスク管理」 |

各リポジトリの `README.md` にも、そのリポジトリ固有の事情が書いてある。
特に **papunto-pandia は同一ドメイン配信の設定**、**papunto-sns は投稿の仕組み**が
READMEにしか無い。
