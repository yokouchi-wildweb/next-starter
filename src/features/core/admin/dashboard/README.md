# 管理ダッシュボード（src/features/core/admin/dashboard）

管理画面トップ（`/admin`）のダッシュボードを、**セクションのファイル**を置く受け口から組み立てる仕組み。上流のセクションも fork のセクションも同じ受け口に置き、同じ一覧に並ぶ。fork はセクションを足す・隠す・並べ替えるために Screen を写さない。

| 置き場 | 中身 |
|---|---|
| `sections/<名前>.ts(x)` | `export const section = defineDashboardSection({ … })`（セクション 1 つ = 描画 `Section` と取得 `load` の組） |
| `../extensionPoints.ts` | 宣言 `dashboardSections`（メニューの受け口と同じファイル）。一覧は `pnpm generate extensions` が `../extensions/dashboardSections.ts` に出す（取得を含むので server で読む） |
| `types.ts` | 定義・上書き・組み立て器の入出力の型 |
| `buildAdminDashboard.ts` | 組み立て器（純関数）と `defineDashboardSection` |
| `services/server/sectionLoads.ts` | `loadAdminDashboardData(viewer)`: 組み立て器で絞ったセクションの `load` を並列に実行し、描く key → 結果を返す |
| `components/AdminDashboard.tsx` | data のキーの順にセクションを描く（server）|
| `components/sections/` | 上流のセクションの描画の部品（`MainMetricsSection`・`AdditionalMetricsSection`。公開の部品） |
| `components/parts/` | 装飾カードなどの共通部品 |

名前（ファイル名）は英字始まりの英数字（camelCase）で、定義の `key` と同じにする。上書きの対象もこの名前。

## セクションの定義

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

| 属性 | 意味 |
|---|---|
| `key` | 一意の名前 = ファイル名 |
| `order` | 並び（昇順、同じ値は key 順。ファイル名の順は使わない） |
| `Section` | 描画。サーバーのデータは自分で取らず `data` で受ける |
| `load?` | 取得（server）。AdminHome の loader が範囲の守り（guard.ts）と loader の `access` を通った後に実行する |
| `allowRoles?` | 見せるロール |
| `feature?` | 門番の規則（`src/featureGate`）の名前。閉 = 描かない・取得しない |
| `hidden?` | override だけが使う。描かない・取得しない |

- 見え方は門番の規則（`feature`）と `allowRoles` だけで決める。ダッシュボード専用の on/off は持たない（メニューと同じ考え）。見え方は認可ではない: 画面の守りは範囲の `guard.ts` と loader の `access`
- 描画と取得を同じ定義に並べるので、片方だけの登録漏れが起きない。セクションの部品は `services/server`・DB を import しない（取得は `load` に書く）
- 項目のファイル自体は `components/` の外（`sections/`）にあり、取得の関数を import してよい。一覧は server で読む: Client Component から一覧・`sections/` を import しない

## 組み立ての流れ

1. `/admin` の loader（`src/app/admin/(protected)/_screen/loader.ts`）が `loadAdminDashboardData({ role: user?.role })` を呼ぶ
2. 組み立て器が生成の一覧（override は重なり済み）を order・key 順に並べ、`hidden` → ロール → 門番（`gate.enabled(feature)`）で絞る
3. 残ったセクションの `load` を並列に実行し、`{ <key>: 結果 }`（load の無いセクションは `undefined`）を返す。キーの並び = 描く順
4. Screen が `<AdminDashboard data={sections} />` を描く。AdminDashboard は data のキーの順に一覧の `Section` を描くだけ

`loadAdminDashboardData()` を引数なしで呼ぶとロール無しとして扱う（`allowRoles` のあるセクションは描かない）。

## fork がすること

- 足す: 自分のセクションのファイルを `sections/` に置いて `pnpm generate extensions`（受け口の外の `src/features/core/` に足すと `pnpm workflow ownership check` が落ちる）。描画の部品と取得は自分のドメインに置き、項目のファイルは組にするだけにする
- 上流のセクションを変える・隠す: その隣に `<名前>.override.ts`（`export const override = { … } satisfies AdminDashboardSectionOverride`）。書けるのは `order`・`hidden`（true で隠す）・`allowRoles`（絞るだけ）。相手の無い上書き・挙げていない属性は `pnpm check extensions` が、`allowRoles` を広げる上書きは `pnpm check admin-menu` が落とす
- 上流のセクションの見た目を変える: `Section` は上書きできない。隠して自分のセクションを足す（中身は上流の部品 `components/sections/*`・`components/parts/*` から組んでよい）
- ダッシュボードごと作り変える: 従来どおり `src/app/admin/(protected)/_components/` に Screen を置き page.tsx を向ける（`src/lib/screens/README.md`）。そのときもこのドメインは消さない
- 上流は override を出荷しない（`scripts/structure/extensions/README.md`）

## 上流のセクション

| key | order | 取得 | 表示の条件 |
|---|---|---|---|
| `mainMetrics` | 100 | `services/server/mainMetrics.ts`（ユーザー登録総数・本日（日本時間の日）の登録数。境目は `@/utils/date` の `dayRangeInTimeZone`） | 設定 `adminConfig.dashboard.showMainMetrics`（既定 false。false なら取得側が null を返し何も描かない） |
| `additionalMetrics` | 200 | なし | 設定 `adminConfig.dashboard.showAdditionalMetrics`（既定 false） |

この 2 つの設定は受け口より前からある上流のセクションの中身の設定で、fork のセクションには使わない（fork の見え方は `feature`・`allowRoles`・override の `hidden`）。

## セクションの部品の書き方

- **データは props の data で受ける**: サーバーのデータを自分で取らない
- **null を返してよい**: 取得側が null を返したときなど、`return null` で消える
- **Section ラッパを使う**: `<Section id="...">` で外側を包む
- **SecTitle で見出し**: `<SecTitle>...</SecTitle>` で揃える
- Client Component にするなら先頭に `"use client"`。server-only なものを import せず、data（シリアライズできる値）を受ける

## 検査とテスト

- `pnpm check extensions`: 相手の無い上書き・宣言に無い鍵・受け口の形
- `pnpm check admin-menu`: key とファイル名の食い違い・`allowRoles` を広げる上書き・`Section` の無い定義（メニューと同じ門の検査。`scripts/structure/admin-menu/`）
- テスト: `pnpm test src/features/core/admin scripts/structure/admin-menu`（組み立て器・上流の中身・点検）
- `export const dynamic = "force-dynamic"` は `page.tsx` 側で持つ
