# 管理ダッシュボード（src/features/core/admin/dashboard）

## Overview

- 管理画面トップ（`/admin`）のダッシュボードを、セクションのファイルを置く受け口 `sections/<名前>.ts(x)` から組み立てる仕組み
- セクション 1 つ = 描画 `Section` と取得 `load` の組。描画と取得を同じ定義に並べるので、片方だけの登録漏れが起きない
- 上流のセクションも fork のセクションも同じ受け口に置き、同じ一覧に並ぶ。fork はセクションを足す・隠す・並べ替えるために Screen を写さない
- 受け口の宣言は `../extensionPoints.ts` の `dashboardSections`（メニューの受け口と同じファイル）。一覧は `pnpm generate extensions` が `../extensions/dashboardSections.ts` に出す（取得を含むので server で読む）
- 入口: `@/features/admin/dashboard`（`AdminDashboard`・`defineDashboardSection`・`buildAdminDashboard`・型）。取得は `services/server/sectionLoads.ts` の `loadAdminDashboardData(viewer)`
- 決まり（名前・取得の置き場・見え方・設定の範囲）は札 `.claude/rules/items/features/admin.md`

## Usage

セクションを 1 つ書く:

```ts
// sections/revenue.ts
import { defineDashboardSection } from "@/features/admin/dashboard";
import { RevenueSection } from "@/features/revenue/components/RevenueSection";
import { loadRevenueSummary } from "@/features/revenue/services/server/dashboard";

export const section = defineDashboardSection({
  key: "revenue",
  order: 150,                 // 上流は 100 刻み(mainMetrics 100・additionalMetrics 200)。fork はその間に入れる
  Section: RevenueSection,    // ({ data }) => …。Server / Client Component どちらでも
  load: loadRevenueSummary,   // 省略可。server の取得。結果がそのまま Section の data になる(型も揃う)
  allowRoles: ["admin"],      // 省略 = 全員
  feature: "revenue",         // 省略可。門番の規則の名前。閉じていれば描かず取得もしない
});
```

- 描画の部品と取得は自分のドメインに置き、項目のファイルは組にするだけにする。項目のファイルは `components/` の外（`sections/`）にあり、取得の関数を import してよい
- セクションの部品の書き方:
  - データは props の `data` で受ける
  - `return null` で消えてよい（取得側が null を返したときなど）
  - 外側を `<Section id="...">` で包み、見出しは `<SecTitle>` で揃える
  - Client Component にするなら先頭に `"use client"`。server-only なものを import せず、data（シリアライズできる値）を受ける
- 上流の部品（`components/sections/*`・`components/parts/*`）は公開の部品。自分のセクションの中身を組むのに使ってよい
- `export const dynamic = "force-dynamic"` は `page.tsx` 側で持つ

## API

`defineDashboardSection` の属性:

- `key`: 一意の名前 = ファイル名
- `order`: 並び（昇順、同じ値は key 順。ファイル名の順は使わない）
- `Section`: 描画。サーバーのデータは `data` で受ける
- `load?`: 取得（server）。AdminHome の loader が範囲の守り（guard.ts）と loader の `access` を通った後に実行する
- `allowRoles?`: 見せるロール
- `feature?`: 門番の規則（`src/featureGate`）の名前。閉 = 描かない・取得しない
- `hidden?`: override だけが使う。描かない・取得しない

`loadAdminDashboardData(viewer)`:

- 返り値 `{ <key>: 結果 }`（load の無いセクションは `undefined`）。キーの並び = 描く順
- 引数なしで呼ぶとロール無しとして扱う（`allowRoles` のあるセクションは描かない）

上流のセクション:

- `mainMetrics`（order 100）: 取得 `services/server/mainMetrics.ts`（ユーザー登録総数・本日（日本時間の日）の登録数。境目は `@/utils/date` の `dayRangeInTimeZone`）。表示は設定 `adminConfig.dashboard.showMainMetrics`（false なら取得側が null を返し何も描かない）
- `additionalMetrics`（order 200）: 取得なし。表示は設定 `adminConfig.dashboard.showAdditionalMetrics`
- この 2 つの設定は受け口より前からある上流のセクションの中身の設定。fork のセクションの見え方は `feature`・`allowRoles`・override の `hidden`

## Extension

- 足す: 自分のセクションのファイルを `sections/` に置いて `pnpm generate extensions`（受け口の外の `src/features/core/` に足すと `pnpm workflow ownership check` が落ちる）
- 上流のセクションを変える・隠す: その隣に `<名前>.override.ts`（`export const override = { … } satisfies AdminDashboardSectionOverride`）。書けるのは `order`・`hidden`（true で隠す）・`allowRoles`
- 上流のセクションの見た目を変える: `Section` は上書きできない。隠して自分のセクションを足す
- ダッシュボードごと作り変える: `src/app/admin/(protected)/_components/` に Screen を置き page.tsx を向ける（`src/lib/screens/README.md`）。そのときもこのドメインは消さない
- 上流は override を出荷しない（`scripts/structure/extensions/README.md`）
- 設定: 上書き `src/config/features/admin.config.ts`（持ち主 `../config.ts`）。`dashboard.showMainMetrics` / `showAdditionalMetrics`（上流のセクションを出す。false なら取得もしない）・`coffeeLevel`、`dataTable.emptyFieldFallback`（管理の一覧の表で値の無い欄に出す文字）

## Internals

1. `/admin` の loader（`src/app/admin/(protected)/_screen/loader.ts`）が `loadAdminDashboardData({ role: user?.role })` を呼ぶ
2. 組み立て器 `buildAdminDashboard`（純関数、`buildAdminDashboard.ts`）が生成の一覧（override は重なり済み）を order・key 順に並べ、`hidden` → ロール → 門番（`gate.enabled(feature)`）で絞る
3. 残ったセクションの `load` を並列に実行し、描く key → 結果を返す
4. Screen が `<AdminDashboard data={sections} />` を描く。AdminDashboard（server）は data のキーの順に一覧の `Section` を描くだけ

- 見え方は認可ではない: 画面の守りは範囲の `guard.ts` と loader の `access`
- 型（定義・上書き・組み立て器の入出力）は `types.ts`

## Verification

- `pnpm check extensions`: 相手の無い上書き・宣言に無い鍵・受け口の形
- `pnpm check admin-menu`: key とファイル名の食い違い・`allowRoles` を広げる上書き・`Section` の無い定義（メニューと同じ門の検査。`scripts/structure/admin-menu/`）
- テスト: `pnpm test src/features/core/admin scripts/structure/admin-menu`（組み立て器・上流の中身・点検）

## Related

- メニューの受け口: `../menu/README.md`
