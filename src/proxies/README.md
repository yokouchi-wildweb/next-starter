# src/proxies — リクエストの前処理（Next.js 16 proxy）

`src/proxy.ts` が `src/proxies/index.ts` のハンドラ列を順に実行する。各ハンドラは Response を返せば打ち切り（intercept）、何も返さなければ次へ進む。順序: maintenanceProxy → demoModeProxy → featureGateProxy → redirectProxy。

このファイルでは、その中で最も多くの機能に関わる **Feature Gate** を説明する。

## Feature Gate（機能のオン・オフ）

機能フラグ（`src/config/app/app-features.config.ts`）を false にした機能を、**ルートとテーブルの両方から**閉じる仕組み。fork が upstream の機能を「削除せず使わないまま残す」ための土台。

| 部品 | 場所 | いつ効くか | やること |
|---|---|---|---|
| 定義 | `src/config/app/feature-gate.config.ts` の `featureGateRules` | — | 機能ごとに `enabled` / `pathPatterns` / `tables` を宣言する |
| ルートゲート | `src/proxies/featureGate.ts` | リクエストごと | `pathPatterns` に一致するページを `/404`、API を 404 にする |
| スキーマゲート | `scripts/registry/schemaGate.ts`（`pnpm db:push` / `db:push:check` が使う） | push のとき | `tables` を push 対象から外す |
| 検査 | `pnpm test:feature-gate`（`src/proxies/featureGate.test.mjs`） | CI / 手元 | 定義の書き漏れ・書き間違いを検出する |

### スキーマゲートは作る方向にしか働かない

| 状態 | `pnpm db:push` の結果 |
|---|---|
| 最初から false | テーブルは作られない |
| false → true（初めて） | 次の push で作られる |
| true → false | **テーブルもデータも残る**（DROP しない）。false の間はスキーマ変更も当たらず、true に戻した push でまとめて反映される |

仕組み: 無効なテーブルを push の**両側**から外す。コード側（pushSchema に渡すスキーマ）から外すので作られず、DB 側（tablesFilter）からも外すので既存でも DROP されない。片側だけだと「コード側だけ = DROP TABLE CASCADE」「DB 側だけ = 既存テーブルへの CREATE」になる（実測済み）。

- enum は外さない（コード側から消すと DROP TYPE が出る。空の型が残るだけで無害）。
- serial / identity 列（sequence）を持つテーブルは想定していない。ゲート対象のテーブルに足す場合は sequence の扱いを検証すること。
- `drizzle-kit push` を直接叩くとゲートを通らない（全テーブルが作られる。消えはしない）。push は必ず `pnpm db:push` で行う。

### ルールの書き方

```ts
{
  pathPatterns: ["/wallet", "/api/wallet", "/api/me/wallet", ...],
  tables: ["wallets", "wallet_lots", "wallet_histories"],
  enabled: APP_FEATURES.wallet.enabled,
},
```

- `pathPatterns` はセグメント境界の前方一致（`/demo` は `/demo-login` を含まない）。`=` を付けると完全一致（`=/mypage` は `/mypage` だけで、fork が `/mypage/<自分のページ>` を足しても巻き込まない）。照合は `src/proxies/pathPattern.mjs`（proxy・ルート地図・test:feature-gate が共有）。動的セグメントは書けないので、値が config で決まるなら展開して書く（例: 通貨 slug ごとの `/wallet/<slug>/purchase`）。
- `tables` は pgTable の第 1 引数（DB のテーブル名）。
- `enabled` は値（boolean）。`src/config/` は値だけを置く層なので関数にしない。
- `redirectTo` を指定すると 404 の代わりにそこへ rewrite する（例: サインアップ停止中の `/signup-closed`）。

### 決まりごと

- **ゲート対象のドメインにルートやテーブルを足したら、同じルールに追記する。** `pnpm test:feature-gate` が次を検査する:
  - `tables` の名前が schemaRegistry に実在する
  - **今 `enabled: false` のルールについて**、そのテーブルを定義するドメインを import するルート（route.ts / page.tsx と `_screen/` `_components/` 配下）が、そのルールの `pathPatterns` で閉じている
  - 同じく、そのドメインの汎用 CRUD（`/api/<domain>`）が閉じている
  - 現在のフラグで、外すテーブルを残すテーブルが外部キーで参照していない
- **有効な機能のルートは検査しない。** 開いていて正しいので、その機能を土台にした fork（コイン経済のサービス等）は何も宣言しなくてよい。機能を切ると、その機能に依存するルートと外部キーがテストで一覧になる（= 切る前に直す場所）。
- **upstream は `FEATURE_GATE_CHECK=all pnpm test:feature-gate` で検査する。** upstream は全機能が有効なので、既定の検査では新しい core ルートの書き漏れに気づけない。`all` は全ルールを無効とみなし、全機能 false でスキーマゲートが成立することも検査する。意図的に閉じない upstream のルートはテスト内の `ROUTE_EXCEPTIONS` に理由付きで書く。
- **他の機能からの呼び出しは、呼び出し側でフラグを見る。** ゲートが閉じるのはその機能自身のルートとテーブルだけ。常に通るコード経路（登録・退会・管理画面の一覧・集計・cron）から無効な機能のサービスを呼ぶと、テーブルが無くて 500 になる。現在の例:
  - 退会時の後片付け（`src/registry/userCleanupRegistry.ts`）
  - 登録時の招待コード消し込み（`auth/services/server/registration.ts`）
  - コイン創出サマリーのソース（`src/registry/coinIssuanceRegistry.ts`）
  - 管理画面ユーザー一覧の残高調整（`user/components/admin/*UserList/Table.tsx`）
  - cron タスクの `enabled`（`src/app/api/cron/<name>/task.ts`。CLI の `pnpm task` は proxy を通らないため）
- **機能どうしの前提**: payment は wallet を前提にする（`purchase_requests` → `wallet_histories` の外部キー。push 時に例外になる）。referral は coupon を前提にする（招待コードの実体はクーポン。テストで検査）。

### 形の扱い

- `=` の完全一致と `APP_FEATURES.pages` は、fork が upstream の画面を消さずに止めるための受け口として足した（評議会 20261022-165923 D21）。feature-gate の config の形（規則の書き方・フラグの置き場）は config 再設計の論点として持ち越している（D12）

### fork での使い方

- upstream の機能を使わない: その機能のフラグを false にする。ルートは 404、テーブルは作られない。コードは削除しない。
- upstream の画面を使わない: 画面を消したり `_` 付きに rename したりせず（所有の検査で違反、src/lib/forkOwnership/README.md）、`APP_FEATURES.pages`（マイページ全体と account の各画面・/entry・/services・規約 3 種）か `adminConsole` のスイッチ（サンプルのドメイン・チャットルームの管理・通知テンプレート・デモユーザー）を false にする。止めたページはルート地図に `gated-off(<pattern>)` と載る。置き換えたいときは止めずに 1 行スイッチで `_components/` の Screen へ向ける
- スイッチの無い upstream の画面を止めたい: upstream に依頼する（`/order <親>`）。fork のルールで upstream の画面を止めない（upstream のルールと重なり、merge のたびに見直しになる）
- fork 自身の機能を閉じたい: `featureGateRules` に 1 ルール足す（`src/config/` の値の変更なので core 編集ではない）。upstream の機能と一緒に開閉させるなら同じフラグを `enabled` に書く（例: payment に依存する fork 機能 = `enabled: APP_FEATURES.payment.enabled`）。upstream のルールの `pathPatterns` / `tables` に fork のものを書き足さない（merge で衝突する）。
- 機能を切ったら `pnpm test:feature-gate` が列挙するルート・テーブルを、上の fork ルールに入れるか、呼び出し側でフラグを見る。
