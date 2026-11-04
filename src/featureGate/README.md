# src/featureGate — 門番(機能を閉じる仕組み)

機能フラグ(`src/config/app/app-features.config.ts` ほか)を false にした機能を、**ルートとテーブルの両方から**閉じる仕組み。fork が upstream の機能を「削除せず使わないまま残す」ための土台。

src 直下の専用の基盤に置く(lib にも core のドメインにも置かない)。src 直下の基盤に置いてよいのは、ドメインの集合を横断する仕組みだけ(今は featureGate・registry・wiring)。maintenance・demoMode・cron のタスクなど、仕組みに従う側は置かない。

## 置き場

| 置き場 | 持ち主 | 中身 |
|---|---|---|
| `rules/<名前>.ts` | 上流・fork(受け口) | 機能を閉じる規則(1 機能 1 ファイル、`export const rule`)。名前 = ファイル名 = `FeatureName` |
| `alwaysOnExceptions/<名前>.ts` | fork(受け口、上流の項目は 0) | 常時実行の入口の例外(`export const exception` か `export const registry`) |
| `required/<機能名>.ts` | fork(受け口、器) | この fork が必ず使う機能(`export const required: RequiredFeature`)。働き(依存の検査)は次の区切り |
| `extensionPoints.ts` | 上流 | 受け口の宣言(`rules`・`alwaysOnExceptions`・`alwaysOnRegistries`・`required`) |
| `extensions/` | 生成物 | `pnpm extensions:generate` が書く一覧(手で編集しない)。`rules.ts` は名前の union `FeatureName` も出す |
| `index.ts` | 上流 | 入口(server・proxy): `gate` と型 |
| `client.ts` | 上流 | 入口(client、器。Provider と `useGate` は次の区切り) |
| `node.ts` | 上流 | 入口(道具: scripts とテストだけ): `rules`・`gatedSchema`・`closedTables`・例外の一覧 |
| `types.ts`・`evaluate.ts`・`hiddenHref.ts`・`tools/server/`・`tools/client/`・`node/` | 上流 | 型・判定の中身(外に出さない。`hiddenHref.ts` = 隠す判定の純関数、server と client が共有)・1 道具 1 ファイルと束・道具の中身 |
| `checks/` | 上流 | 検査(`pnpm test:feature-gate`・`:reach`・`:tools`) |

## 入口と gate の口

外からは入口 3 つだけを読む(lint `import-boundaries/feature-gate-entries`、全 Tier error)。lib は門番を読まない(値も型も。規則や判定は引数で受ける)。`node.ts` は scripts とテストだけ。テストは中の部品を読んでよい。

```ts
import { gate, type FeatureName } from "@/featureGate";

gate.enabled("wallet");        // 規則 rules/wallet.ts の enabled() の答え。未知の名前は型で落ち、実行時は throw
gate.assert("wallet");         // 閉じていれば DomainError(404、決まった文言)を投げる。開いていれば何もしない
gate.path("/wallet/history");  // { open: true } | { open: false; rule: FeatureName; redirectTo?: string }
gate.filter(menuItems);        // 閉じた機能の住所を指す項目を除く(既定は item.href、順は保つ)
gate.filter(rows, (row) => row.link); // href を持たない型は住所の取り出し方を渡す(型で必須)
```

- `gate.assert`: service・API が自分で止まるときに使う。文言は「お探しのページは見つかりませんでした」で固定、機能の名前・`code`・`details` は出さない(閉じた機能の存在を利用者に知らせない)。未知の名前は `gate.enabled` と同じく throw
- `gate.path`: 一覧の順(ファイル名の順)で最初の閉じた規則に当たれば `{ open: false, rule, redirectTo }`。読み手は proxy の項目 `src/proxies/featureGate.ts`(応答を作る)と demo の loader(閉じたデモを一覧から外す)
- `gate.filter`: メニュー・一覧から閉じた住所の行を隠すだけ(応答は proxy が作る)。除くのは「`/` で始まる内部の住所(`//` は別オリジンで対象外)で、閉じた住所の並びの順で最初に当たった規則に `redirectTo` が無い」項目だけ。`?` と `#` の後ろは照合から外す。外部 URL・`redirectTo` 付きの閉(行き先の画面がある。例: サインアップ → `/signup-closed`)・住所の無い項目(`getHref` が `undefined`)は残す。判定は `hiddenHref.ts` の純関数で、リンクの自動で隠す判定(client)も同じ関数を使う
- 既存の読み手(demo の loader・service の自己停止・管理メニュー)は `gate.assert` / `gate.filter` へ移す途中(まだ直読み・`gate.path` の箇所がある)
- 中の名前(`isFeatureEnabled`・`resolvePath`)は外に出さない。道具を足すときは `tools/server/<名前>.ts` に 1 ファイル、束 `tools/server/index.ts` に 1 行

## 機能を閉じる規則

機能フラグ（`src/config/app/app-features.config.ts` ほか）を false にした機能を、**ルートとテーブルの両方から**閉じる仕組み。fork が upstream の機能を「削除せず使わないまま残す」ための土台。

| 部品 | 場所 | いつ効くか | やること |
|---|---|---|---|
| 規則 | `rules/<名前>.ts` の `export const rule` | — | 1 機能 1 ファイル、名前 = ファイル名 = `FeatureName`。`pathPatterns` / `features` / `enabled()` / `redirectTo` |
| 一覧 | `extensions/rules.ts`（生成物） | — | 規則 + 名前 + `features` から導いた表名。読み手は入口(`gate`・`node.ts` の `rules`)を通してこれだけを読む |
| ルートゲート | `src/proxies/featureGate.ts`(`gate.path` を呼ぶ) | リクエストごと | `pathPatterns` に一致するページを `/404`、API を 404 にする |
| スキーマゲート | `node/gatedSchema.ts`（`@/featureGate/node` の `gatedSchema`、`pnpm db:push` / `db:push:check`） | push のとき | 導いた表を push 対象から外す |
| 検査 | `pnpm test:feature-gate`・`pnpm extensions:check` | CI / 手元 | 書き漏れ・書き間違い・常時実行の入口の閉じ漏れ |

### 規則の書き方

```ts
// src/featureGate/rules/wallet.ts
import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["/wallet", "/api/wallet", "/api/me/wallet"],
  features: ["core/wallet", "core/walletHistory"],
  enabled: () => APP_FEATURES.wallet.enabled,
};
```

- `pathPatterns` はセグメント境界の前方一致（`/demo` は `/demo-login` を含まない）。`=` を付けると完全一致（`=/mypage` は `/mypage` だけで、fork が `/mypage/<自分のページ>` を足しても巻き込まない）。照合は `src/lib/pathPattern`（門番の判定・ルート地図・test:feature-gate が共有）。動的セグメントは書けないので、値が config で決まるなら展開して書く（例: 通貨 slug ごとの `/wallet/<slug>/purchase`）
- **閉じた住所の下の画面・API は一緒に閉じる**（前方一致）。上流の規則の接頭の下に fork が足した画面も閉じる
- `features` = 外す表を持つ機能のフォルダ（`src/features` からの相対、文字列リテラルの配列）。表名は書かない: `extensions:generate`（宣言の `derive: "featureTables"`）がフォルダの下の全 `pgTable` から導く（`scripts/registry/tableScan.mjs`、字面・コメントの中は見ない）。fork が上流のフォルダに足した表も上流の規則が拾う。フォルダの一部の表だけを外す書き方は無い。表を持たない規則は `features` を書かない
- `enabled` は config の値を読む同期関数（値の置き場は config）
- `redirectTo` を指定すると 404 の代わりにそこへ rewrite する（例: サインアップ停止中の `/signup-closed`）
- 住所の重なりは許す（OR）。**行き先の違う重なりは、ファイル名の順で最初の無効な規則の `redirectTo`**。上流の規則どうしの行き先の違う重なりは `test:feature-gate` で失敗、fork の規則と上流の重なりは表示だけ
- 上流の規則を fork が上書き・無効化する口は無い（fork は閉じる規則を足すだけ）

### スキーマゲートは作る方向にしか働かない

| 状態 | `pnpm db:push` の結果 |
|---|---|
| 最初から false | テーブルは作られない |
| false → true（初めて） | 次の push で作られる |
| true → false | **テーブルもデータも残る**（DROP しない）。false の間はスキーマ変更も当たらず、true に戻した push でまとめて反映される |

仕組み: 無効なテーブルを push の**両側**から外す。コード側（pushSchema に渡すスキーマ）から外すので作られず、DB 側（tablesFilter）からも外すので既存でも DROP されない。片側だけだと「コード側だけ = DROP TABLE CASCADE」「DB 側だけ = 既存テーブルへの CREATE」になる（実測済み）。

- enum は外さない（コード側から消すと DROP TYPE が出る。空の型が残るだけで無害）
- serial / identity 列（sequence）を持つテーブルは想定していない。ゲート対象のテーブルに足す場合は sequence の扱いを検証すること
- `drizzle-kit push` を直接叩くとゲートを通らない（全テーブルが作られる。消えはしない）。push は必ず `pnpm db:push` で行う
- 外す表を残す表が外部キーで参照していると例外（導いた表に掛かる）

### 決まりごと

- **ゲート対象のドメインにルートを足したら、同じ規則の `pathPatterns` に追記する**（表は `features` のフォルダから自動で入る）。`pnpm test:feature-gate` が次を検査する:
  - 導いた表名が schemaRegistry に実在する（走査の表の集合 = schemaRegistry の全表は `pnpm test:schema-registry`）
  - **今 `enabled()` が false の規則について**、その表を定義するドメインを import するルート（route.ts / page.tsx と `_screen/` `_components/` 配下）が、その規則の `pathPatterns` で閉じている
  - 同じく、そのドメインの汎用 CRUD（`/api/<domain>`）が閉じている
  - 現在のフラグで、外す表を残す表が外部キーで参照していない
  - 常時実行の入口の閉じ漏れ（下）
- **有効な機能のルートは検査しない。** 開いていて正しいので、その機能を土台にした fork は何も宣言しなくてよい。機能を切ると、その機能に依存するルートと外部キーがテストで一覧になる（= 切る前に直す場所）
- **`FEATURE_GATE_CHECK=all pnpm test:feature-gate` は upstream も fork も実行する。** 全規則を無効とみなし、全機能 false でスキーマゲートが成立することも検査する。意図的に閉じない upstream のルートはテスト内の `ROUTE_EXCEPTIONS`、fork の例外は `alwaysOnExceptions/<名前>.ts` に理由付きで書く
- **サンプルのドメイン**（`sampleDomain`、`APP_FEATURES.adminConsole.enableSampleDomain`）: 既定 `true`（上流のデモ用）。権限は公開読み・ログイン済みの更新・子の画像のログイン済みアップロードのままで厳しくしない → **実際の利用者がいる fork は `false` にする**: 管理画面・`/api/sample*` の汎用 API・サンプルを読むデモ画面 4 つが 404、5 表（samples ほか）は db:push で作らない（既存の表と行は消さない）。管理のメニューの行は残る
- **機能どうしの前提**: payment は wallet を前提にする（`purchase_requests` → `wallet_histories` の外部キー。push 時に例外になる）。referral は coupon を前提にする（招待コードの実体はクーポン。テストで検査）

### 常時実行の入口

ゲートが閉じるのはその機能自身のルートとテーブルだけ。常に動く処理（cron・退会の後片付け・集計の照合・常に読み込まれる結線）が無効な機能を使うと、テーブルが無くて失敗する。`test:feature-gate` が全規則を無効とみなして次を見る（判定: `checks/alwaysOnEntries.mjs`）:

| 入口 | 閉じ方 |
|---|---|
| cron の `src/app/api/cron/<name>/task.ts` | `cronTask` に `enabled`（config を読む同期関数。CLI の `pnpm task` は proxy を通らない） |
| 宣言に `alwaysOn: true` の拡張点の項目（`cleanupHandlers`・`coinIssuanceSources`・`rollupMetrics`） | 項目に `enabled` |
| fork の手書きの登録表（下の `registries`） | 使い所を `...(<フラグ> ? [x] : [])` で包む |
| 常に読み込まれる結線（`src/app/layout.tsx`・`src/wiring/**`・`src/proxies/**`・`src/featureGate/**`） | import しない。避けられないものは理由付きの例外表 |

- 上流の例外表はテスト内の `ALWAYS_ON_EXCEPTIONS`（縮む表。当たらなくなった行は失敗）
- **fork の分は 1 項目 1 ファイルの受け口に理由つきで**: `alwaysOnExceptions/<名前>.ts`(名前は英字始まりの英数字、fork の印は付けない。宣言の点 `alwaysOnExceptions`・`alwaysOnRegistries`)
  ```ts
  // src/featureGate/alwaysOnExceptions/storeMembers.ts(常に読み込まれる結線の例外)
  import type { AlwaysOnException } from "@/featureGate";
  export const exception: AlwaysOnException = { file: "src/wiring/storeMembers.ts", reason: "<閉じなくてよい理由>" };
  // src/featureGate/alwaysOnExceptions/storeCleanup.ts(fork の手書きの登録表)
  export const registry: AlwaysOnException = { file: "src/registry/storeCleanup.ts", reason: "<常に読まれる理由>" };
  ```
  1 ファイルに `exception` か `registry` のどちらか 1 つ(生成器が止める)、`reason` は必須、縮む表の規則は fork の行にも掛かる。旧い置き場 `scripts/proxies/alwaysOnExceptions/<名前>.mjs`・`scripts/proxies/alwaysOnExceptions.<x>.mjs` は止まり、移し方を案内する(`scripts/codemods/feature-gate-relocate.mjs`)
- 限界: 直接の import だけを見る（別のモジュールを経由した到達は見ない）。`enabled` の式が本当にその機能のフラグかは見ない
- 上の外にも呼び出し側でフラグを見る経路がある（登録時の招待コード消し込み `auth/services/server/registration.ts`、管理画面ユーザー一覧の残高調整 `user/components/admin/*UserList/Table.tsx`）。サービスの層で止める仕組みは別の議題

### fork での使い方

- upstream の機能を使わない: その機能のフラグを false にする。ルートは 404、テーブルは作られない。コードは削除しない
- upstream の画面を使わない: 画面を消したり `_` 付きに rename したりせず（所有の検査で違反、src/lib/forkOwnership/README.md）、`APP_FEATURES.pages`（マイページ全体と account の各画面・/entry・/services・規約 3 種）か `adminConsole` のスイッチ（サンプルのドメイン・チャットルームの管理・通知テンプレート・デモユーザー）を false にする。止めたページはルート地図に `gated-off(<pattern>)` と載る。置き換えたいときは止めずに 1 行スイッチで `_components/` の Screen へ向ける
- スイッチの無い upstream の画面を止めたい: upstream に依頼する（`/order <親>`）。fork の規則で upstream の画面を止めない（upstream の規則と重なり、merge のたびに見直しになる）
- fork 自身の機能を閉じたい: `rules/<名前>.ts`(上流の規則と違う名前)に規則を 1 つ置き、`pnpm extensions:generate`。upstream の機能と一緒に開閉させるなら同じフラグを `enabled` に書く（例: `enabled: () => APP_FEATURES.payment.enabled`）
- 機能を切ったら `pnpm test:feature-gate` が列挙するルート・表・入口を、規則に入れるか、呼び出し側でフラグを見る

## 守り

- lint `import-boundaries/feature-gate-entries`: 外からは入口 3 つだけ・lib は読まない・`node.ts` は scripts とテストだけ(`eslint-rules/import-boundaries.mjs`)
- 到達の検査 `pnpm test:feature-gate:reach`: `index.ts`・`client.ts` から値の import をたどり、features の services・`src/lib/drizzle`・DB のパッケージ・`server-only`・`node:` に届いたら鎖を示して落とす(門番は proxy と client の束に載る。規則は config だけを読む)
- lint `page-authz/session-api-callsite` は `src/featureGate/**` にも掛かる(規則と判定はセッションを解かない)
- 所有の検査(`pnpm ownership:check`): fork が受け口の外(`rules/`・`alwaysOnExceptions/`・`required/` の外)へ足したファイルは `gate-add` で違反(`src/lib/forkOwnership/README.md`)

## 旧い置き場からの移行(fork)

旧い置き場(`src/proxies/featureGateRules/`・`scripts/proxies/alwaysOnExceptions/`・`src/proxies/pathPattern.mjs`・`scripts/registry/schemaGate.ts`・生成一覧 `src/proxies/extensions/featureGateRules.ts`)からの移し方は `node scripts/codemods/feature-gate-relocate.mjs`(dry-run → `--apply`、`scripts/codemods/README.md`)。旧い型 `@/proxies/types` の `FeatureGateRule` は非推奨の再 export で次の区切りまで残る。
