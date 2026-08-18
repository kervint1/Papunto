# 決定事項ログ

## 2026-08-18 Yapeをブランドとして前面に出さない

Yapeの名前は**支払いがどう届くかの説明**にだけ使い、サイトタイトル・OG画像・LPのヒーロー・バッジには出さない。ロゴは `/canjear` の交換先一覧（機能上の選択肢）にだけ置く。

### 理由

**提携していないブランドを看板にしていた。** Yapeは BCP（Banco de Crédito del Perú）のサービスで、papuntoとは何の関係もない。それをサイトタイトルとOG画像に入れると提携しているように見える。規約（`/terminos`）には「Yape es un servicio operado por el Banco de Crédito del Perú」と第三者である旨を明記しているのに、表の顔がそうなっていないのは一貫していない。

**送金手段に縛られる。** Yape送金のAPIは持っておらず運用は手作業。将来PayPalや携帯チャージに寄せたくなったときに看板を変えることになる（`/canjear` には既に両方が「Próximamente」で並んでいる）。

**Yapeを使わない人を最初に排除する。**

### ただし完全には消さない

「dinero」だけだと受け取り方が分からず、詐欺を疑う人への説明にならない。ペルーで「Yapeで届く」は具体性そのものなので、**流れの説明とFAQの2箇所だけ**残す。

### 未対応

サイトタイトルとOG画像（`Papunto — Gana puntos y cámbialos por dinero en Yape`）はまだ変えていない。LPと合わせて直す。


## 2026-08-10 記事URLを `/blog/<slug>` のキーワード形式にした

記事URLからカテゴリ階層と `/posts/` を外し、`papunto.pe/blog/<タイトル由来のslug>` に統一した。slugはタイトルから自動生成し、書き手は入力しない。

### 乱数IDにしなかった理由

note・はてなブログ・Amebaは意味を持たないID（乱数や日付＋時刻）を使っており、それを踏襲する案を検討した。だが**あれはUGCプラットフォーム固有の制約**によるもので、papuntoには当てはまらない。

- 日本語タイトルはURLにできない（「今日の日記」をASCIIに落とすと空になる）。全言語で破綻しない手段がIDしかない
- 数百万人規模の投稿があり衝突処理が要る／利用者がタイトルを頻繁に書き換える
- SEOは**プラットフォームのドメイン評価**で稼ぐため、個別URLの単語は誤差

papunto-pandiaは自社ドメインのスペイン語メディアで、どれも当てはまらない。

実際に狙うクエリ（`ganar dinero encuestas Perú` 等）で上位に出るサイトと、同業（報酬アプリの自社メディア）を12件調べた結果、**キーワードslugが11件、ID併用が1件、乱数のみは0件**だった。

| サイト | URL |
| --- | --- |
| Honeygain（報酬アプリの自社ブログ。papuntoと同型） | `honeygain.com/blog/best-cash-back-apps/` |
| Fetch（同上） | `fetch.com/blog/smart-shopping/best-cashback-apps` |
| NerdWallet | `nerdwallet.com/credit-cards/best/cash-back` |
| Comparabien（ペルーの金融比較） | `comparabien.com.pe/blog-consejos/como-ganar-dinero-por-internet` |
| Panamericana（ペルーのTV局） | `panamericana.pe/tecnologia/437949-ganar-dinero-internet-peru-...` |

唯一IDを使うPanamericanaもニュースサイトで、`437949-` の後ろにキーワードを繋げている。1日に何十本も出るため衝突回避のIDが要るが、キーワードは捨てないという折衷。

なおslug自体のランキング効果は小さい。効くのは検索結果とSNSでリンクの中身が読めることで、**自動生成なら書き手の負担ゼロで得られる**ため採用した。

### カテゴリをURLに入れなかった理由

NerdWalletやFetchはカテゴリをパスに含めるが、**カテゴリの性質が違う**。彼らのカテゴリは編集部が固定した分類で記事は必ず1つに属する。papuntoのカテゴリは記事のタグから動的に決まり、1記事が複数に該当しうるうえ後から変わる。URLに焼くと分類変更のたびにリダイレクトと評価の引き継ぎが要る。

カテゴリ別の一覧が必要になったら、記事URLを変えずに `/blog/categoria/<id>` を足せる。将来カテゴリを固定分類に変えるなら、URLに入れる選択肢は復活する。

### slugは書き手が触らない

タイトルをそのまま落とすとURLが長くなる（スペイン語は `de` `con` `en` `para` のような機能語が多い）。毎回手で短くするのは続かないので、`auto_slug()` が機能語を落として8語・60文字で切る。

```
Cómo ganar dinero con encuestas en Perú (guía 2026)
  → /blog/como-ganar-dinero-encuestas-peru-guia-2026
```

`cómo` `dónde` `qué` のような疑問詞は**落とさない**。狙う検索クエリそのものだからで（"cómo ganar dinero"）、落とすと `/blog/papunto` のような無意味なURLになる。手で入力したslugは意図があるので短縮せず、書いたとおりに使う。

### 名前空間の衝突対策

記事を `/blog/<slug>` 直下に置くと、メディア側のルートと名前空間を共有する。Next.jsは静的セグメントを動的セグメントより優先するため、`/blog/categoria/...` を足した時点で slug が `categoria` の記事は**エラーを出さずに404になる**。評価を積んだ記事が消えても気づけない。

対策として `server/routers/posts.py` の `RESERVED_SLUGS` を「埋まっている」扱いにし、記事が予約語を取れないようにした（`categoria` → `categoria-2`）。手入力のslugにも同じ判定が効く。

**カテゴリやタグは `/blog/categoria/<id>` のように一段掘って置く。** そうすれば予約語が増えるのは機能を足すときの1語だけで、カテゴリ数やタグ数には比例しない。

なお予約語リストはpapunto側にあり、ルートを足すのはpapunto-pandia側なので、同期は強制されない。pandiaの `app/[slug]/page.tsx` 冒頭に注意書きを置いてある。

### 付随して直した不具合

管理画面の「新規作成」は仮タイトル `Nuevo artículo` で記事を作るが、**slugは作成時に一度生成されるだけでタイトルに追従しなかった**。エディタは読み込んだslugをそのまま送り返すため、手で直さない限り全記事が `nuevo-articulo-N` のまま公開される状態だった。

`posts.slug_custom` を追加し、手動指定でない下書きはタイトルから毎回作り直すようにした。「手で決めたか」はslugの文字列からは判別できない（連番サフィックスが付くため `slugify(title)` との比較では誤判定する）ためフラグで持つ。公開後は従来どおりURLを固定する。

## 2026-08-05 改訂2: 管理画面を自作する方針に変更（従来の「自作しない」を撤回）

2026-07-22の決定「`/admin` は自作せず、TablePlus等のDBクライアントでHeroku Postgresに直接接続して運用する」を撤回し、`/admin` 配下に管理画面を実装した。

### 撤回した理由

- **換金の承認・却下をSQLで手作業するのが危険**。却下時はポイントを返還する必要があるが、`UPDATE withdrawals` と `UPDATE users` を人手で2本打つ運用は、片方を忘れるとユーザーの残高が消える。1トランザクションで扱うべき処理だった
- **操作履歴が一切残らない**。誰がいつどの申請を処理したかを後から追えなかった
- 管理対象がMVP当時の3テーブルから7テーブル（`users`/`postbacks`/`postback_logs`/`withdrawals`/`topups`/`complaints`/`admin_logs`）に増え、DBクライアントでの一覧・絞り込みが実用的でなくなった
- **苦情記録簿（Indecopi）は応答義務がある**ため、対応状況を確実に管理する手段が要る

### 設計（[ticketjam](https://github.com/kervint1/ticketjam) の管理画面を参照）

| 項目 | 決定内容 |
| --- | --- |
| 管理者判定 | `users.is_admin`（boolean）。**画面からは昇格させず**、DBクライアントで直接UPDATEする（管理画面が乗っ取られても管理者を増やされないため） |
| 認可 | `APIRouter(dependencies=[Depends(require_admin)])` でルーター単位に付ける。ticketjamは基底クラス継承漏れで認可が抜けたコントローラが実在したため、**個別エンドポイントに書かせない**構造にした |
| 監査ログ | `admin_logs` テーブル。操作対象・変更内容のスナップショット・自由記述メモを、業務処理と同一トランザクションで記録する |
| 換金の却下 | ポイント返還・ステータス更新・履歴記録を1トランザクションで実行。終端状態の申請は409で弾く（二重送金・二重返還の防止） |
| サイドバーのバッジ | 未処理件数を60秒キャッシュする。ticketjamは全管理ページに集計コストが乗り、実測4,470msの劣化を踏んでいる |
| 一覧の絞り込み | 許可リストで検証し、**未知の値は空振りさせず全件にフォールバック**（廃止した絞り込みのブックマーク対策） |

### ticketjamから引き継がなかった点

- **ロールの多段化**（super_admin / collaborator / writer 等）は作らない。運用者が1人のため `is_admin` の1段で足りる
- **メールアドレスのホワイトリスト**による追加ゲートは作らない（新規メンバー追加のたびにデプロイが必要になるため）
- ticketjamには横断的な監査ログテーブルが無く、`admin_memo`・個別履歴テーブル・Slack通知の組み合わせで運用している。papuntoは最初から `admin_logs` に一本化した

### 残っている課題

管理画面のIP制限・2FA・短いセッションタイムアウトはいずれも未実装（ticketjamも未対応）。運用者が増える前に検討する。

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
