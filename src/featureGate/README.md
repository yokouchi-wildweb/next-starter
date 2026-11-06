# src/featureGate — 門番(機能を閉じる仕組み)

機能フラグ(`src/config/app/app-features.config.ts` ほか)を false にした機能を、**ルートとテーブルの両方から**閉じる仕組み。fork が upstream の機能を「削除せず使わないまま残す」ための土台。

src 直下の専用の基盤に置く(lib にも core のドメインにも置かない)。src 直下の基盤に置いてよいのは、ドメインの集合を横断する仕組みだけ(今は featureGate・registry・wiring)。maintenance・demoMode・cron のタスクなど、仕組みに従う側は置かない。

## 置き場

| 置き場 | 持ち主 | 中身 |
|---|---|---|
| `rules/<名前>.ts` | 上流・fork(受け口) | 機能を閉じる規則(1 機能 1 ファイル、`export const rule`)。名前 = ファイル名 = `FeatureName` |
| `alwaysOnExceptions/<名前>.ts` | fork(受け口、上流の項目は 0) | 常時実行の入口の例外(`export const exception` か `export const registry`) |
| `dependencyExceptions/<名前>.ts` | fork(受け口、上流の項目は 0) | 依存の検査の例外(`export const exception: DependencyException`) |
| `required/<機能名>.ts` | fork(受け口) | この fork が必ず使う機能(`export const required: RequiredFeature`)。依存の検査はこの機能のフォルダを外から読むことを通す。features:set / list での働きは次の区切り |
| `extensionPoints.ts` | 上流 | 受け口の宣言(`rules`・`alwaysOnExceptions`・`alwaysOnRegistries`・`dependencyExceptions`・`required`) |
| `extensions/` | 生成物 | `pnpm extensions:generate` が書く一覧(手で編集しない)。`rules.ts` は名前の union `FeatureName` も出す |
| `index.ts` | 上流 | 入口(server・proxy): `gate`・配線用の `clientGateState` と型 |
| `client.ts` | 上流 | 入口(client): `useGate`・`GatedLink`・配線用の `GateProvider` と型 |
| `node.ts` | 上流 | 入口(道具: scripts とテストだけ): `rules`(全開スイッチを通した一覧)・`configRules` / `configEnabled` / `configPath`(規則の値だけ)・`isOpenedBySwitch`・`gatedSchema`・`closedTables`・例外の一覧 |
| `ruleList.ts`・`openSwitch.ts` | 上流 | 判定の入口(生成一覧を全開スイッチで包む。門番の中で生成一覧を値で読み、規則の `enabled()` を直に呼ぶのはここだけ)と全開スイッチ(「全開スイッチ」の節) |
| `types.ts`・`evaluate.ts`・`hiddenHref.ts`・`area.ts`・`clientState.ts`・`tools/server/`・`tools/client/`・`node/` | 上流 | 型・判定の中身(外に出さない。`hiddenHref.ts` = 隠す判定・`area.ts` = 枠の判定の純関数で server と client が共有、`clientState.ts` = client に渡す値の計算)・1 道具 1 ファイルと束・道具の中身 |
| `checks/` | 上流 | 検査(`pnpm test:feature-gate`・`:reach`・`:tools`・`:client`) |

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
- 管理のコマンドパレットの移動の候補は、管理の枠の中の橋 `AdminCommandGateBridge` が渡す厳密な `useGate().path` の判定で絞る(`redirectTo` 付きの閉も隠す。枠の外では絞らない。`src/features/core/adminCommand/README.md`)
- 既存の読み手(demo の loader・service の自己停止・管理メニュー)は `gate.assert` / `gate.filter` へ移す途中(まだ直読み・`gate.path` の箇所がある)
- 中の名前(`isFeatureEnabled`・`resolvePath`)は外に出さない。道具を足すときは `tools/server/<名前>.ts` に 1 ファイル、束 `tools/server/index.ts` に 1 行(client でも使う道具は `tools/client/` にも同じ名前で。束の名前の一致は `checks/gateTools.test.ts`: client の名前 ⊆ server、server だけの名前は `assert` だけ)

## client の口(useGate)

client は規則を評価しない。server が計算した値(`clientGateState(area)` = `{ 規則名: 開閉 }` と枠で絞った閉じた住所の並び)を `GateProvider` で受け取り、`useGate()` が読む。

```tsx
"use client";
import { useGate } from "@/featureGate/client";

const gate = useGate();
gate.enabled("referral");        // server の gate.enabled と同じ答え。未知の名前は throw
gate.path("/mypage/invite");     // { open: true } | { open: false; rule; redirectTo? }(範囲の中は server と同じ)
gate.filter(menuItems);          // server の gate.filter と同じ判定(hiddenHref.ts)
```

- 枠(範囲): 利用者の枠(`user`)= `/admin` と `/api` の下を除く住所。管理の枠(`admin`)= 利用者の枠 + `/admin` の下。`/api` の下はどの枠にも入らない
- 配線: root の `src/app/layout.tsx` が `clientGateState("user")` を `src/wiring/AppProviders.tsx` に渡し、AppProviders が一番外で `GateProvider` で包む。admin の守りの layout(`src/app/admin/(protected)/layout.tsx`・`src/app/admin/insane/layout.tsx`)が guard の後に `clientGateState("admin")` で包み直す。管理の住所は守りの後にだけ渡すので、公開ページの HTML に出ない(`/admin/login`・`/admin/setup` は利用者の枠)。root layout はクライアント遷移で描き直されないので、枠の切替は入れ子の Provider で行う
- `clientGateState`・`GateProvider` は配線用。使えるのは上の 4 ファイルだけ(lint `feature-gate-entries`)。画面・部品は `useGate()` を使う
- 範囲の外の住所・Provider の外で聞くと、dev(`NODE_ENV !== "production"`)は throw(書き間違いに気づかせる)、本番は閉とみなす: `enabled` は false、`path` は `{ open: false, rule: null }`、`filter` は内部の住所の項目を除く(外部 URL・住所の無い項目は残す)
- 値は deploy で決まる config から作るので、ページを開いた時点の値のまま(クライアント遷移では計算し直さない)

## リンク(棚の Link・GatedLink)

閉じた機能へのリンクは自動で消える。新しい機能(規則)を足しても、既存のリンク箇所は書き換えない。

- 棚の Link(`@/components/Navigation` の `Link`、next/link の包み)と `LinkButton`: 棚の口 `LinkVisibilityProvider` に `GateProvider` が判定を差し込む。`gate` prop: `auto`(既定、判定に従う)・`always`(閉じていても描く逃げ道)・`hide`(描かない)。棚の README: `src/components/Navigation/Link/README.md`
- `GatedLink`(`@/featureGate/client`): 同じ判定で描かない。棚の口の差し込みに依らない(口を別の判定で包み直した場所の中でも門番の判定で隠す)
- 隠すのは「`/` で始まる内部の住所で、今の枠の中の、`redirectTo` の無い閉じた機能の住所」だけ(判定 `tools/client/linkHidden.ts` → `hiddenHref.ts`、`gate.filter` と同じ)。外部 URL・`redirectTo` 付きの閉・枠の外(利用者の枠で `/admin`)・Provider の外は描く(`useGate` と違い throw しない)
- server component の中から使ってよい(client 部品として Provider の中で SSR され、判定が効く)。server 版の GatedLink は作らない
- `next/link` の直 import は lint `import-boundaries/link-via-shelf` が知らせる(上流 error、fork は規則の住所の字面に当たるファイルだけ warn。字面に出ない住所は見えない限界: 棚の Link の README)

## 機能を閉じる規則

機能フラグ（`src/config/app/app-features.config.ts` ほか）を false にした機能を、**ルートとテーブルの両方から**閉じる仕組み。fork が upstream の機能を「削除せず使わないまま残す」ための土台。

| 部品 | 場所 | いつ効くか | やること |
|---|---|---|---|
| 規則 | `rules/<名前>.ts` の `export const rule` | — | 1 機能 1 ファイル、名前 = ファイル名 = `FeatureName`。`pathPatterns` / `features` / `enabled()` / `redirectTo` |
| 一覧 | `extensions/rules.ts`（生成物） | — | 規則 + 名前 + `features` から導いた表名と汎用 API の住所(`domainApiPaths`)・設定の節の住所(`settingPaths`、どちらも `pathPatterns` にも足す)。読み手は入口(`gate`・`node.ts` の `rules`)を通してこれだけを読む |
| ルートゲート | `src/proxies/featureGate.ts`(`gate.path` を呼ぶ) | リクエストごと | `pathPatterns` に一致するページを `/404`、API を 404 にする |
| API の部品工場 | `src/wiring/apiRoute.ts` が `gate.path` を Factory の口 `gate` に結ぶ | API のリクエストごと | 閉じた住所の API は Factory も 404(proxy の安全網。`src/lib/routeFactory/README.md`) |
| スキーマゲート | `node/gatedSchema.ts`（`@/featureGate/node` の `gatedSchema`、`pnpm db:push` / `db:push:check`） | push のとき | 導いた表を push 対象から外す |
| 検査 | `pnpm test:feature-gate`・`pnpm extensions:check` | CI / 手元 | 書き漏れ・書き間違い・常時実行の入口の閉じ漏れ |

### 規則の書き方

```ts
// src/featureGate/rules/wallet.ts
import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "@/featureGate";

export const rule: FeatureGateRule = {
  pathPatterns: ["/wallet", "/api/me/wallet"], // 汎用 API の /api/wallet・/api/walletHistory は書かない(features から導く)
  features: ["core/wallet", "core/walletHistory"],
  enabled: () => APP_FEATURES.wallet.enabled,
};
```

- `pathPatterns` はセグメント境界の前方一致（`/demo` は `/demo-login` を含まない）。`=` を付けると完全一致（`=/mypage` は `/mypage` だけで、fork が `/mypage/<自分のページ>` を足しても巻き込まない）。照合は `src/lib/pathPattern`（門番の判定・ルート地図・test:feature-gate が共有）。動的セグメントは書けないので、値が config で決まるなら展開して書く（例: 通貨 slug ごとの `/wallet/<slug>/purchase`）
- **閉じた住所の下の画面・API は一緒に閉じる**（前方一致）。上流の規則の接頭の下に fork が足した画面も閉じる
- `features` = 規則が閉じるドメインのフォルダ（`src/features` からの相対で `core/<名前>` か `<名前>`、文字列リテラルの配列）。無いフォルダ・ドメインの位置でない書き方（`core/wallet/entities` のような深い場所・`core` そのもの）は生成器が止める。表名は書かない: `extensions:generate`（宣言の `derive: "featureTables"`）がフォルダの下の全 `pgTable` から導く（`scripts/structure/registry/tableScan.mjs`、字面・コメントの中は見ない）。fork が上流のフォルダに足した表も上流の規則が拾う。フォルダの一部の表だけを外す書き方は無い。表を持たないドメイン（Firestore 版の `core/chatRoom` など）も書ける: 表は 0 のまま、汎用 API の住所と依存の検査は表のあるドメインと同じに効く
- **汎用 API の住所（`/api/<domain>`）は書かない**: 生成器が `features` の各フォルダの `services/server/domainEntry.ts` の `domainEntries` のキーから `/api/<キー>` を導き（字面）、一覧の項目の `domainApiPaths` と `pathPatterns` の後ろに足す（全部の読み手に効く）。`domainEntry.ts` の無いフォルダは何も足さない。手書きと重なると `test:feature-gate` が知らせる（上流の規則は失敗、fork の規則は表示だけ）。ドメインを足した・キーを変えたら `pnpm extensions:generate`（ずれは `extensions:check` が止める）
- **設定の節の住所（`/admin/settings/<key>`）も書かない**: 設定の節（`src/features/core/setting/sections/`）に `feature: "<規則名>"`（か配列）を書くと、生成器がその規則の `settingPaths` と `pathPatterns` に足す（`scripts/structure/extensions/derive/gateSettingPaths.mjs`）。管理メニューの行は住所の絞り込みで消える。規則名でない `feature` は生成で失敗
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

### db:clear と閉じた機能の表

`pnpm db:clear`（`scripts/operations/db/clear/`、計画は純関数 `plan.ts`、検査 `pnpm test:db-clear`）は閉じた機能の表（`@/featureGate/node` の `closedTables`）に触れない。

- 選べる表（対話の選択肢と `--all`）から閉じた表を外し、外した表は名前を出す
- 選んだ表を参照する表を schemaRegistry の外部キーから推移的に足し、確認の前に「選んだ表 / 足した参照元 / 外した表（DB に無い・閉じた）」を見せる
- DB にある閉じた表が消す表を参照していると、何も消さずに全部並べて exit 1（DB に無い閉じた表には制約も無いので止めない）
- 消すのは 1 文の `TRUNCATE TABLE "a", "b", … RESTRICT`（全部消えるか何も消えないか。連鎖の削除は使わない）
- 閉じた表も選び・参照元に足すのは `--include-closed` のときだけ

### seed と閉じた機能

`pnpm db:seed` の項目（`scripts/db/seed/data/registry.ts`）は省略可の `feature?: FeatureName | FeatureName[]` を持ち、1 つでも閉じていれば飛ばして名前を出す。閉じられるフォルダを import する項目に `feature` が無いと `pnpm test:db-seed` が落とす。詳細: `scripts/db/seed/README.md`「閉じた機能と seed」

### 決まりごと

- **ゲート対象のドメインにルートを足したら、同じ規則の `pathPatterns` に追記する**（表は `features` のフォルダから自動で入る）。`pnpm test:feature-gate` が次を検査する:
  - 導いた表名が schemaRegistry に実在する（走査の表の集合 = schemaRegistry の全表は `pnpm test:schema-registry`）
  - **今 `enabled()` が false の規則について**、その規則の `features` のドメイン（表の数は問わない）を import するルート（route.ts / page.tsx と `_screen/` `_components/` 配下）が、その規則の `pathPatterns` で閉じている（判定 `checks/routeImports.mjs`。`features` の無い規則は対象外）
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
| cron の `src/app/api/cron/<name>/task.ts` | タスクの住所 `/api/cron/<name>` を、import する機能のフォルダを `features` に持つ規則の全部が `pathPatterns` で覆う（閉じた機能のタスクは route = `@/wiring/cronRoute`・`pnpm task`・`cron:generate` が住所で飛ばす。task.ts に機能の入切は書かない。`src/lib/cron/README.md`「機能の門」） |
| 宣言に `alwaysOn: true` の拡張点の項目（`cleanupHandlers`・`coinIssuanceSources`・`rollupMetrics`） | 項目に `enabled` |
| fork の手書きの登録表（下の `registries`） | 使い所を `...(<フラグ> ? [x] : [])` で包む |
| 常に読み込まれる結線（`src/app/layout.tsx`・`src/wiring/**`・`src/proxies/**`・`src/featureGate/**`） | import しない。避けられないものは理由付きの例外表 |

- 規則のファイル（`rules/<名前>.ts`）が機能のドメインの入切の値 `@/features/<d>/config`（`config.ts`、値だけ）を読むのは閉じ漏れに数えない（入切の値の置き場はそのドメインの config。`closable` のひな形がこの形）。`config.ts` が値の外（services・drizzle・server-only）に届くと到達の検査 `test:feature-gate:reach` が止める

- 上流の例外表はテスト内の `ALWAYS_ON_EXCEPTIONS`（縮む表。当たらなくなった行は失敗）
- **fork の分は 1 項目 1 ファイルの受け口に理由つきで**: `alwaysOnExceptions/<名前>.ts`(名前は英字始まりの英数字、fork の印は付けない。宣言の点 `alwaysOnExceptions`・`alwaysOnRegistries`)
  ```ts
  // src/featureGate/alwaysOnExceptions/storeMembers.ts(常に読み込まれる結線の例外)
  import type { AlwaysOnException } from "@/featureGate";
  export const exception: AlwaysOnException = { file: "src/wiring/storeMembers.ts", reason: "<閉じなくてよい理由>" };
  // src/featureGate/alwaysOnExceptions/storeCleanup.ts(fork の手書きの登録表)
  export const registry: AlwaysOnException = { file: "src/registry/storeCleanup.ts", reason: "<常に読まれる理由>" };
  ```
  1 ファイルに `exception` か `registry` のどちらか 1 つ(生成器が止める)、`reason` は必須、縮む表の規則は fork の行にも掛かる。旧い置き場 `scripts/proxies/alwaysOnExceptions/<名前>.mjs`・`scripts/proxies/alwaysOnExceptions.<x>.mjs` は止まり、移し方を案内する(`.notices/20261104-173649-feature-gate-relocate.feature-gate-relocate.mjs`)
- 限界: 直接の import だけを見る（別のモジュールを経由した到達は見ない）。`enabled` の式が本当にその機能のフラグかは見ない
- 上の外にも呼び出し側でフラグを見る経路がある（登録時の招待コード消し込み `auth/services/server/registration.ts`、管理画面ユーザー一覧の残高調整 `user/components/admin/*UserList/Table.tsx`）。サービスの層で止める仕組みは別の議題

### fork での使い方

- upstream の機能を使わない: その機能のフラグを false にする。ルートは 404、テーブルは作られない。コードは削除しない
- upstream の画面を使わない: 画面を消したり `_` 付きに rename したりせず（所有の検査で違反、src/lib/forkOwnership/README.md）、`APP_FEATURES.pages`（マイページ全体と account の各画面・/entry・/services・規約 3 種）か `adminConsole` のスイッチ（サンプルのドメイン・チャットルームの管理・通知テンプレート・デモユーザー）を false にする。止めたページはルート地図に `gated-off(<pattern>)` と載る。置き換えたいときは止めずに 1 行スイッチで `_components/` の Screen へ向ける
- スイッチの無い upstream の画面を止めたい: upstream に依頼する（`/order <親>`）。fork の規則で upstream の画面を止めない（upstream の規則と重なり、merge のたびに見直しになる）
- 新しいドメインを閉じられる形で作る: domain.json に `"closable": true`（Neon のみ）を書いて `pnpm forge`。dc:generate が規則 `rules/<domain>.ts`（管理画面の住所・`features`・`enabled`）と入切の値 `src/features/<domain>/config.ts` の `<SNAKE>_CONFIG.enabled`（既定 fork = true・Tier1 = false）を書き捨てで書く。汎用 API の住所は導出に任せる。画面を足したら規則の `pathPatterns` に手で足す
- fork 自身の機能を閉じたい: `rules/<名前>.ts`(上流の規則と違う名前)に規則を 1 つ置き、`pnpm extensions:generate`。upstream の機能と一緒に開閉させるなら同じフラグを `enabled` に書く（例: `enabled: () => APP_FEATURES.payment.enabled`）
- 機能を切ったら `pnpm test:feature-gate` が列挙するルート・表・入口を、規則に入れるか、呼び出し側でフラグを見る
- ウォレットと購入を外す(規則 `wallet` と `payment` を閉じる): core を編集しなくてよい。画面・汎用 API・自前の API・webhook・cron(`wallet-*`・`expire-pending-purchases`)の住所が閉じ、常時実行の項目(一括調整のジョブ・退会の後片付け・コイン発行の源)が止まり、管理メニューの行と利用者の管理一覧の残高調整・coupon の購入割引のカテゴリが消える(`checks/walletOff.test.tsx`、`test:feature-gate:client`)
- 区切り gate-s3 の取り込み: 依存の検査が fork でも落ちる。codemod `.notices/20261105-112509-feature-gate-automation.feature-gate-s3.mjs` が今開いている機能の違反を `required/` に書き出し、cron の route.ts の import を直す(`.notices/README.md` の codemod の節)

### features:list / features:set

道具は門番の `node.ts`（`readFeatureReport`・`planFeatureSet`、`node/describe.ts`・`node/setEnabled.ts`）。scripts はそれを呼ぶだけ（`scripts/operations/features/`）。

- `pnpm features:list [--name <規則名>] [--json]`: 規則ごとに開閉・必須（`required/`）・住所（手書き / 汎用 API の導出 / 設定の節の導出）・機能のフォルダ・表・依存（閉じられるフォルダを外から値で読むファイルと、許された形。依存の検査の走査そのもの。許されていない依存は「未」と出る）・名前の呼び出し箇所（`gate.enabled` / `gate.assert` / `useGate().enabled` の字面の `"<名前>"`。変数で渡す名前は見えない）。読むだけ
- `pnpm features:set <規則名> on|off`: 規則の `enabled` が機能のドメインの config の `<X>_CONFIG.enabled` だけを読み（`enabled: () => X_CONFIG.enabled`、`@/features/<d>/config` から import）、その `config.ts` の `<X>_CONFIG` にリテラルの `enabled: true|false` が 1 つだけあるとき、その 1 行を書き換える（`closable` のひな形の形、L1.19）。それ以外は何も書かず、規則の `enabled` の字面（値を読む場所）を出して exit 2（手で直す）。必須の機能を off にしようとすると何も書かずに exit 1
- `features:set` は `db:push`・`extensions:generate` を打たない（表を持つ機能を開けたら `pnpm db:push` は人が打つ）
- 上流の規則は今どれも共有の config（`APP_FEATURES` など）を読むので `features:set` は場所の案内だけになる。入切の値がドメインの config へ移った規則から書けるようになる

### 依存の検査

閉じられるフォルダ(規則の `features`)を、そのフォルダの外から値で import するファイルは、次のどれかでなければ `pnpm test:feature-gate` が落ちる(判定: `checks/dependencies.mjs`):

1. 自分のドメインの `services/server/domainEntry.ts` の `requires` に相手のドメインがある(`requires: ["wallet"]`、文字列リテラルの配列で書く。字面で読む)
2. ファイルが規則の名前で確かめる: `gate.enabled("wallet")`・`gate.assert("wallet")`・`useGate().enabled("wallet")`
3. ファイルが src/app の下で、その規則の `pathPatterns` が覆う住所にある(page・loader・route・`_screen`・`_components` など。閉じれば一緒に閉じる)
4. 同じ規則のフォルダどうし
5. fork の `required/<規則名>.ts` がある(この fork はその機能を必ず使う = 依存を書いたとみなす)
6. 例外: `dependencyExceptions/<名前>.ts` に理由つきで(字面で判定できない物: 動的 import の結線・wiring の遅延 import など)。上流の例外は 0(上流の結線は確かめる側で通す。例: `src/wiring/apiRoute.ts` は端末の束を `gate.enabled("pairedDevice")` で結ぶ)

- 数えない: 生成の一覧(`src/registry`)・`src/featureGate`・テスト・型だけの import。動的 import と副作用 import は数える
- 上流の違反は 0(全 Tier で同じ検査。上流の縮む表は 0 行になって表ごと消した)
- 強さ: 全 Tier で落とす(区切り gate-s3 から。gate-s2 の間は Tier1 でない repo では表示だけだった)。fork の移行は codemod `.notices/20261105-112509-feature-gate-automation.feature-gate-s3.mjs`(今開いている機能の違反を `required/<規則>.ts` に書き出す。閉じた機能の違反は一覧に出すので手で直す。`.notices/README.md` の codemod の節)
- 限界: 字面だけを見る。別のモジュールを経由した到達、2 の呼び出しが import の使い所を本当に守っているか、機能どうしの前提(payment が閉じれば wallet の画面も閉じる等)はたどらない

### 門番の範囲外

門番が閉じるのは、規則の住所(ページ・API)・表・常時実行の入口・リンクとメニュー・依存の検査が見る import まで。次は門番では止まらないので、その機能の側で閉じる:

- 他のドメインの画面の中の細かい出し分け(欄・ボタン・文言の一部): その画面が `useGate().enabled` / `gate.enabled` で確かめる
- API を通らない書き込み・読み出し: client から直に Firestore に書く処理、外部サービスの webhook を自前で受ける処理など(住所で閉じないので、規則の住所の外で動く)
- 規則の `enabled` の式が本当にその機能の入切かは見ない

## 全開スイッチ(FEATURE_GATE_OPEN)

閉じた機能を env 1 つで開ける(上流の開発・デモで全機能を見る、fork の開発で sample を見る)。規則の値(config)は書き換えない。

```bash
FEATURE_GATE_OPEN=all              # 全規則を開く
FEATURE_GATE_OPEN=coupon,wallet    # 名前の規則だけ開く(区切りは , と空白。名前 = rules/<名前>.ts)
```

- 未設定・空 = 規則の値のまま。未知の名前は判定のたびに throw(打ち間違いを黙って閉じたままにしない。proxy では全リクエストが失敗するので、置いたらすぐ気付く)
- 効く条件: 段階(`@/lib/appEnv` の `getAppEnv()`、決まりは [src/lib/appEnv/README.md](../lib/appEnv/README.md))が `development` なら全 Tier。staging・production(値なし・知らない値も)は **Tier1 だけ**。効かない所(fork の本番など)では値を読まない(置かれていても落とさない)
- Tier1 の判別(`openSwitch.ts` の `isTier1Build` 1 つ): Next のビルドは `next.config.ts` が fork_id(`readForkIdentity().isTier1`)から計算して埋め込む `FEATURE_GATE_TIER1`(fork の build では `"false"`。埋め込みが勝つので Vercel の env では上書きできない)。注入の無い node(scripts・テスト)は `node.ts` が読むだけで渡す読み手 `node/tier1.ts`。`openSwitch.ts` は proxy の束に載るので `node:` を読まない
- 判定の入口は `ruleList.ts` の 1 つ: 生成一覧の各規則の `enabled` を「スイッチで開いていれば true、でなければ規則の `enabled()`」に差し替えた `rules`。門番の口・`clientGateState` はこれを読み、client は server の答えを受け取るだけ(client で env を読み直さない)

道具ごとの効く範囲(L2.3):

| 道具 | スイッチ | 読む物 | 理由 |
|---|---|---|---|
| 門番の口(`gate.*`)・proxy・`useGate()` | 効く | `rules` | 開けた機能の画面・API を見る |
| `pnpm db:push` / `db:push:check` の表 | 効く | `rules` | 開けた機能の表を作る(開発の DB だけ。`ENV_FILE` の env ファイルの `APP_ENV` で決まる: `.env.development` なら全 Tier、`APP_ENV=production` か値なしのファイルなら Tier1 だけ) |
| `pnpm db:seed`・`pnpm db:clear` | 効く | node の `gate.enabled`・`closedTables(rules)` | 表と同じ答え |
| `pnpm features:list` | 見せ方 | `rules` + `configEnabled` + `isOpenedBySwitch` | 規則の値で閉・スイッチで開を「閉 → 開(スイッチ)」と出す。`--json` は `enabled`・`configEnabled`・`openedBySwitch` |
| `pnpm cron:generate` / `cron:check`・`pnpm task` | 効かない | `configPath` | `vercel.json` と照合が env で揺れない。スイッチで開けた機能の cron は `vercel.json` に載らない(route は開くので手で叩けば動く) |
| `pnpm routes:map` | 効かない | `configRules` | コミットする `route-map.jsonl` が env で揺れない |
| `FEATURE_GATE_CHECK` の検査・依存の検査・codemod `feature-gate-s3` | 効かない | `configRules` | 検査の答えが env で揺れない |
| `pnpm features:set`・`required/` | 関わらない | config の字面 | 規則の値を書く道具 |

検査: `checks/openSwitch.test.ts`(値・効く条件・Tier1 の判別・範囲の表・入口の字面の検査・`next.config.ts` の注入)。

## 守り

- lint `import-boundaries/feature-gate-entries`: 外からは入口 3 つだけ・lib は読まない・`node.ts` は scripts とテストだけ・配線用の `clientGateState`・`GateProvider` は配線の 4 ファイルだけ(`eslint-rules/import-boundaries.mjs`)
- 到達の検査 `pnpm test:feature-gate:reach`: `index.ts`・`client.ts` から値の import をたどり、features の services・`src/lib/drizzle`・DB のパッケージ・`server-only`・`node:` に届いたら鎖を示して落とす(門番は proxy と client の束に載る。規則は config だけを読む)。`client.ts` からは規則・規則の一覧・評価(`evaluate.ts`・`clientState.ts`)・config にも届かない(client は規則を評価しない)
- lint `page-authz/session-api-callsite` は `src/featureGate/**` にも掛かる(規則と判定はセッションを解かない)
- 所有の検査(`pnpm ownership:check`): fork が受け口の外(`rules/`・`alwaysOnExceptions/`・`dependencyExceptions/`・`required/` の外)へ足したファイルは `gate-add` で違反(`src/lib/forkOwnership/README.md`)

## 旧い置き場からの移行(fork)

旧い置き場(`src/proxies/featureGateRules/`・`scripts/proxies/alwaysOnExceptions/`・`src/proxies/pathPattern.mjs`・`scripts/structure/registry/schemaGate.ts`・生成一覧 `src/proxies/extensions/featureGateRules.ts`)からの移し方は `node .notices/20261104-173649-feature-gate-relocate.feature-gate-relocate.mjs`(dry-run → `--apply`、`.notices/README.md` の codemod の節)。旧い型 `@/proxies/types` の `FeatureGateRule`・`GatedFeatureRule` の再 export は区切り gate-s3 で消した(型は `@/featureGate` から。この道具が直す)。
