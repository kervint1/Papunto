# 決定事項ログ

## 2026-08-05: オファーウォールをprovider併存にし、ポストバック設計をticketjamに合わせた

CPALeadは案件一覧をJSONで返すAPIを持つため、iframeに丸投げするMonlixとはデータの流れが変わる。契約前に構造を確かめるため、CPALeadのリクエスト/レスポンスを模したモックをサーバー内に置き、「案件一覧 → クリック → 成果 → ポイント反映」を通しで動かせるようにした。どちらを採用するかは未確定なので、`postbacks.provider` で両方を併存させる。

設計は [ticketjam](https://github.com/kervint1/ticketjam) の GF Rewards オファーウォール連携（`app/controllers/webhooks/gf_rewards_controller.rb` ほか）を参照した。同型の実装が本番品質で入っており、papuntoに欠けていた点が明確だったため。

| 変更 | 理由 |
| --- | --- |
| **署名シークレット未設定なら付与しない**（CPALead側） | 従来の `if not secret: return True` は、本番で設定を忘れると誰でもポイントを付与できる。開発が止まらないよう `CPALEAD_MOCK=true` のときだけ既定値を入れ、設定漏れは安全側（未付与）に倒す |
| `postback_logs`（生ペイロード＋検証結果）を追加 | 付与に至らなかったリクエストの痕跡がどこにも残らず、「なぜ付与されなかったか」を追えなかった |
| 成果を pending / approved / rejected の3状態に | 従来は承認以外を捨てていたため、後から届く承認・否認（規約に条項あり）を扱えなかった |
| 送信元IPの許可リスト | 未実装だった。許可外からのリクエストはログも残さない（ログテーブルが埋まると本当に調べたい記録が行数上限に押し出される） |
| 付与額の上限 `MAX_REWARD_POINTS` | 報酬額はペイロードをそのまま信じており署名対象にも含まれない。上流のバグ・桁誤りによる異常付与の防御層 |
| オファーリンクに `digest` 署名 | 従来の `&subid=<id>` は生のIDで、他人のIDに書き換えて成果を横取りできた |
| 冪等キーを `(provider, transaction_id)` の複合UNIQUEに | 取引IDは提供元ごとの採番なので、単独UNIQUEだと提供元をまたいで衝突しうる |
| pytestを導入（ポストバック限定） | お金が動く経路。ticketjamがRSpecで厚くテストしている観点をそのまま移植した |

**踏襲しなかった点**: ticketjamは案件マスタも一覧APIも持たず、ベンダーがホストするオファーウォールをWebViewに丸投げしている。案件同期のずれ・掲載可否・表記ゆれを全部ベンダー側に押し付けられる合理的な判断だが、今回はCPALeadのJSON APIの構造を確かめること自体が目的なので自前一覧を作った。モックで一周した結果「iframeに任せた方が楽」と判断するなら、`postbacks` 側の設計はそのまま活かして一覧UIだけ捨てられる。

なお ticketjam の `app/services/a8/`（A8.net連携）はTicketJamが**広告主側**としてASPに成果を送る逆向きの実装なので、媒体側であるpapuntoでは参考にしていない。

## 2026-07-26: アプリ名を Papunto に確定

`CashYape` → `Rewardo`（既存サービスと名称衝突）→ **`Papunto`** に変更。Monlix審査申請前のタイミングで決定（審査後だとMonlix側にPostback URL等が登録され、改名時の調整コストが跳ね上がるため、確定を優先した）。

- コード内ブランド表記（Logo・ページタイトル・フッター著作権・FastAPIタイトル）、開発DB名、ドキュメントを一括更新
- GitHubリポジトリ名・Heroku app名・Vercelプロジェクト名も同名に統一する想定（各サービス側の作業は利用者側で実施）

## 2026-07-23: 現金表記をやめ、ポイント制に変更

| 項目 | 決定内容 |
| --- | --- |
| 残高の持ち方 | `users.balance`（DECIMAL, S/) → `users.points`（INT）に変更 |
| 報酬履歴 | `postbacks.reward_amount` → `reward_points`（INT、Monlixの仮想通貨単位） |
| 換金申請 | `withdrawals` は消費ポイント（`points`）とYape送金額（`amount_soles`）の両方を記録 |
| 換金レート | アプリ側で設定: `POINTS_PER_SOL=100`（100 pts = S/ 1）。100 pts単位でのみ換金可 |
| 最低換金 | `MIN_WITHDRAWAL_POINTS=500`（= S/ 5） |
| Monlix側設定 | ダッシュボードのVirtual Currency設定でCurrency Name（例: Coins）とExchange Rate（例: 1 USD = 1,000 Coins）を設定し、iframe内をポイント表示にする |

### 理由

- 現金額を直接表示・保持することが規約上問題になるため（ポイントサイトの一般的な構成でもある）
- 副次効果として、整数ポイント化により浮動小数点・DECIMALの計算ズレの懸念がなくなる

## 2026-07-22 改訂2: 認証をNextAuth.js + 自前JWTに変更

| 項目 | 決定内容 |
| --- | --- |
| データベース | Heroku Postgres（GitHub Educationクレジットで実質無料） |
| 認証 | **NextAuth.js（Google Provider）+ FastAPI自前JWT**（[FarmMatch](https://github.com/kervint1/FarmMatch)の実装を流用） |
| 画像ストレージ | Appwrite Storage（GitHub Student PackでPro相当無料）。**MVPでは未使用**、将来の画像機能用の想定 |
| 管理画面 | 自作しない。TablePlus / pgAdmin等のDBクライアントでHeroku Postgresに直接接続して `withdrawals` を運用 |
| バックエンド | FastAPI + SQLModel をHeroku（Educationクレジット）でホスティング |
| フロントエンド | Next.js on Vercel（無料枠） |
| データアクセス | フロントエンドはDBに直接アクセスせず、読み書きすべてFastAPI経由 |

### 認証をFirebase AuthからNextAuth.jsに変えた理由

- **FarmMatchでの実装経験がそのまま使える**: NextAuth設定・`auth_service.py`（jose/HS256でのJWT発行・検証）・`routers/auth.py` をほぼコピーできる。FarmMatchは構成（Next.js + FastAPI + SQLModel + Postgres + Heroku + Appwrite）が今回とほぼ同一
- **外部サービスがひとつ減る**: Firebaseプロジェクトの作成・管理・サービスアカウントキーの取り回しが不要になる
- **改善点**: FarmMatchではフロントから送られたGoogleプロフィール情報を信頼していたが、今回はお金を扱うため、**GoogleのIDトークンをバックエンドで検証**してからユーザー作成・JWT発行を行う（[05-api-design.md](./05-api-design.md)）

### 副作用

- `users.id` はFirebase UID（TEXT）ではなく、FarmMatchと同じ連番整数 + `google_id` カラム方式に変更
- ログイン方法はMVPでは**Googleログインのみ**（メールログインはNextAuthのEmail Provider追加で将来対応可能）

## 2026-07-22 改訂1: Heroku Postgres + Firebase Auth 構成（認証のみ破棄）

DB・ホスティングの決定（Heroku Postgres / DBクライアント管理 / FastAPI on Heroku / Vercel）はこの時点のものが現在も有効。認証だけFirebase Auth案だったが、FarmMatchパターンの方が実装コストが低いため改訂2で差し替えた。

## 2026-07-22 第1版: Supabase統一案（破棄）

当初、Notion上の旧ドキュメント間でDB・認証・管理画面の記載が食い違っていた（技術スタック案: Appwrite Auth + Heroku Postgres + 自作Admin ／ データ構造案: Supabase Auth + Supabase Postgres + Table Editor）。

一度「管理画面をSupabase Table Editorで代替する」方針を軸にDB・認証・ストレージをSupabaseへ統一する決定をしたが、以下の理由で破棄した:

- SQL（DB）はもともとHeroku（Education無料）を使う予定だった
- Supabaseは学生パック対象外で、Education枠を活かせない
- 「管理画面を自作しない」目的はDBクライアント（TablePlus等）でHeroku Postgresに直接つなぐ運用でも達成できる
