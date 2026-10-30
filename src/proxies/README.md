# src/proxies — リクエストの前処理（Next.js 16 proxy）

`src/proxy.ts` がリクエストごとに文脈 `ctx` を 1 つ作り、`src/proxies/index.ts` の handler 列を順に実行する。各 handler は Response を返せば打ち切り（intercept）、何も返さなければ次へ進む。全部が素通しなら `NextResponse.next()` に decorator 列が副作用（cookie 等）を加える（打ち切ったときは decorator は走らない）。

## 骨組みと枠

```
handler:   maintenance → demoMode → featureGate → redirect → [枠: 項目をファイル名の順に]
decorator: attribution → inviteLink → [枠: 項目をファイル名の順に]
```

| 部品 | 場所 | 誰が書く |
|---|---|---|
| 骨組み（順序に意味がある上流の 4 + 2） | `src/proxies/index.ts`・各 `<名前>.ts` | 上流だけ（fork は index.ts を編集しない） |
| 枠の項目 | `src/proxies/<名前>.ts`（上流）/ `src/proxies/<名前>.<fork ID>.ts`（fork）。フォルダ形 `<名前>[.<fork ID>]/index.ts` も可 | 1 項目 1 つ `export const handler` か `export const decorator` |
| 拡張点の宣言 | `src/proxies/extensionPoints.ts`（handlers・decorators・featureGateRules の 3 点） | 上流だけ |
| 生成一覧 | `src/proxies/extensions/handlers.ts`・`decorators.ts`・`featureGateRules.ts` | `pnpm extensions:generate`（手で編集しない。仕組み: `scripts/extensions/README.md`） |
| 検査 | `pnpm extensions:check`（build の冒頭）・`pnpm test:proxy-frame` | — |

- 項目は骨組みの**後ろ**で、ファイル名の順に走る（Tier 順は使わない）。項目どうしは互いに依存しない（前の項目の結果を読まない）。骨組みより前で走らせたい項目は作らない（要るなら上流へ依頼し、骨組みに吸収する）
- fork の ID は宣言済みのもの（`.claude/rules/project.md` の `fork_id:` か `.notices/applied/<fork-id>.md` の台帳名、`src/lib/forkOwnership/forkIds.mjs`）。宣言に無い ID・`handler` と `decorator` の両方・どちらも無い直下の `.ts`・名前の形の違い・一覧のずれは `extensions:generate` / `extensions:check` が止める
- 印は字面で読む（`export const handler` / `export const decorator` / `export const rule` の形で書く。`export { x as handler }` は拾わない）。項目のファイルは生成器から import しない
- 判定の中身は責務のドメインのサービスを呼ぶ（項目のファイルに業務の判定を書き込まない）。項目の入切は各項目が config の値で持つ（多段での並べ替え・置き換えの口は無い）
- **転送された旧 URL（redirect が Response を返したリクエスト）では枠の項目は走らない**。骨組みが打ち切ったリクエストも同じ
- 項目も UNCONFIGURED_BACKENDS の契約に従う（DB・Firebase が未構成でも落ちない。既存の判定 `isDatabaseConfigured` 等を使う）

## 利用者（ctx.user）

```ts
import type { ProxyHandler } from "./types";

export const handler: ProxyHandler = async (request, ctx) => {
  const user = await ctx.user(); // SessionUser | null
};
```

- `ctx.user()` は**呼ばれたときだけ** 1 回解決し、同じリクエストの中では結果を使い回す（呼ぶ項目が無ければ DB を引かない）
- 解決器は `features/core/auth` の `createProxyUser`（API の Factory・ページの守りと同じ `resolveSessionUser`、DB 同期）。`src/proxy.ts` だけが作る
- **利用可能な status（`USER_AVAILABLE_STATUSES`）の利用者だけ**非 null。停止中・休会中・未ログイン・DB 未構成は null（停止中の管理者・debugger はメンテナンス中に入れない）
- 項目（上流・fork）はセッションを自分で解かない: `getSessionUser`・`resolveSessionUser`・`parseSessionCookie`・`createProxyUser` などの値 import は lint `page-authz/session-api-callsite` が `src/proxies/**` で止める。token のクレームだけで判定する版は無い

## 機能を閉じる規則（Feature Gate）

機能フラグ（`src/config/app/app-features.config.ts` ほか）を false にした機能を、**ルートとテーブルの両方から**閉じる仕組み。fork が upstream の機能を「削除せず使わないまま残す」ための土台。

| 部品 | 場所 | いつ効くか | やること |
|---|---|---|---|
| 規則 | `src/proxies/featureGateRules/<名前>[.<fork ID>].ts` の `export const rule` | — | 1 機能 1 ファイル。`pathPatterns` / `features` / `enabled()` / `redirectTo` |
| 一覧 | `src/proxies/extensions/featureGateRules.ts`（生成物） | — | 規則 + `features` から導いた表名。読み手はこれだけを読む |
| ルートゲート | `src/proxies/featureGate.ts` | リクエストごと | `pathPatterns` に一致するページを `/404`、API を 404 にする |
| スキーマゲート | `scripts/registry/schemaGate.ts`（`pnpm db:push` / `db:push:check`） | push のとき | 導いた表を push 対象から外す |
| 検査 | `pnpm test:feature-gate`・`pnpm extensions:check` | CI / 手元 | 書き漏れ・書き間違い・常時実行の入口の閉じ漏れ |

### 規則の書き方

```ts
// src/proxies/featureGateRules/wallet.ts
import { APP_FEATURES } from "@/config/app/app-features.config";

import type { FeatureGateRule } from "../types";

export const rule: FeatureGateRule = {
  pathPatterns: ["/wallet", "/api/wallet", "/api/me/wallet"],
  features: ["core/wallet", "core/walletHistory"],
  enabled: () => APP_FEATURES.wallet.enabled,
};
```

- `pathPatterns` はセグメント境界の前方一致（`/demo` は `/demo-login` を含まない）。`=` を付けると完全一致（`=/mypage` は `/mypage` だけで、fork が `/mypage/<自分のページ>` を足しても巻き込まない）。照合は `src/proxies/pathPattern.mjs`（proxy・ルート地図・test:feature-gate が共有）。動的セグメントは書けないので、値が config で決まるなら展開して書く（例: 通貨 slug ごとの `/wallet/<slug>/purchase`）
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
- **upstream は `FEATURE_GATE_CHECK=all pnpm test:feature-gate` で検査する。** 全規則を無効とみなし、全機能 false でスキーマゲートが成立することも検査する。意図的に閉じない upstream のルートはテスト内の `ROUTE_EXCEPTIONS` に理由付きで書く
- **サンプルのドメイン**（`sampleDomain`、`APP_FEATURES.adminConsole.enableSampleDomain`）: 既定 `true`（上流のデモ用）。権限は公開読み・ログイン済みの更新・子の画像のログイン済みアップロードのままで厳しくしない → **実際の利用者がいる fork は `false` にする**: 管理画面・`/api/sample*` の汎用 API・サンプルを読むデモ画面 4 つが 404、5 表（samples ほか）は db:push で作らない（既存の表と行は消さない）。管理のメニューの行は残る
- **機能どうしの前提**: payment は wallet を前提にする（`purchase_requests` → `wallet_histories` の外部キー。push 時に例外になる）。referral は coupon を前提にする（招待コードの実体はクーポン。テストで検査）

### 常時実行の入口

ゲートが閉じるのはその機能自身のルートとテーブルだけ。常に動く処理（cron・退会の後片付け・集計の照合・常に読み込まれる結線）が無効な機能を使うと、テーブルが無くて失敗する。`test:feature-gate` が全規則を無効とみなして次を見る（判定: `scripts/proxies/alwaysOnEntries.mjs`）:

| 入口 | 閉じ方 |
|---|---|
| cron の `src/app/api/cron/<name>/task.ts` | `cronTask` に `enabled`（config を読む同期関数。CLI の `pnpm task` は proxy を通らない） |
| 宣言に `alwaysOn: true` の拡張点の項目（`cleanupHandlers`・`coinIssuanceSources`・`rollupMetrics`） | 項目に `enabled` |
| fork の手書きの登録表（下の `registries`） | 使い所を `...(<フラグ> ? [x] : [])` で包む |
| 常に読み込まれる結線（`src/app/layout.tsx`・`src/wiring/**`・`src/proxies/**`） | import しない。避けられないものは理由付きの例外表 |

- 上流の例外表はテスト内の `ALWAYS_ON_EXCEPTIONS`（縮む表。当たらなくなった行は失敗）
- **fork の分は自分のファイルに理由つきで**: `scripts/proxies/alwaysOnExceptions.<fork ID>.mjs`
  ```js
  export const exceptions = [{ file: "src/wiring/foo.acme.ts", reason: "<閉じなくてよい理由>" }];
  export const registries = [{ file: "src/registry/fooCleanup.acme.ts", reason: "<常に読まれる理由>" }];
  ```
  `reason` は必須、fork ID は宣言済みのもの、縮む表の規則は fork の行にも掛かる
- 限界: 直接の import だけを見る（別のモジュールを経由した到達は見ない）。`enabled` の式が本当にその機能のフラグかは見ない
- 上の外にも呼び出し側でフラグを見る経路がある（登録時の招待コード消し込み `auth/services/server/registration.ts`、管理画面ユーザー一覧の残高調整 `user/components/admin/*UserList/Table.tsx`）。サービスの層で止める仕組みは別の議題

### fork での使い方

- upstream の機能を使わない: その機能のフラグを false にする。ルートは 404、テーブルは作られない。コードは削除しない
- upstream の画面を使わない: 画面を消したり `_` 付きに rename したりせず（所有の検査で違反、src/lib/forkOwnership/README.md）、`APP_FEATURES.pages`（マイページ全体と account の各画面・/entry・/services・規約 3 種）か `adminConsole` のスイッチ（サンプルのドメイン・チャットルームの管理・通知テンプレート・デモユーザー）を false にする。止めたページはルート地図に `gated-off(<pattern>)` と載る。置き換えたいときは止めずに 1 行スイッチで `_components/` の Screen へ向ける
- スイッチの無い upstream の画面を止めたい: upstream に依頼する（`/order <親>`）。fork の規則で upstream の画面を止めない（upstream の規則と重なり、merge のたびに見直しになる）
- fork 自身の機能を閉じたい: `src/proxies/featureGateRules/<名前>.<fork ID>.ts` に規則を 1 つ置き、`pnpm extensions:generate`。upstream の機能と一緒に開閉させるなら同じフラグを `enabled` に書く（例: `enabled: () => APP_FEATURES.payment.enabled`）
- fork の handler・decorator: `src/proxies/<名前>.<fork ID>.ts` に置き、`pnpm extensions:generate` で一覧をコミット
- 機能を切ったら `pnpm test:feature-gate` が列挙するルート・表・入口を、規則に入れるか、呼び出し側でフラグを見る
