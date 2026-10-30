# Admin Dashboard ドメイン

管理画面トップページ (`/admin`) のダッシュボードを「セクション駆動」で構築するコアドメイン。
ダウンストリームでの **大規模な作り変え・部分差し替え** を最小コンフリクトで行えるよう、
page.tsx は薄いシェルに留め、内容は本ドメインの `registry.ts` で組み立てる構造を採用している。

---

## 設計思想

| 観点 | 採用 |
|------|------|
| ページ責務 | `app/admin/(protected)/_screen/AdminHomeScreen.tsx` はシェル (AdminPage + PageTitle + `<AdminDashboard data={sections} />`)。データは同じルートの `_screen/loader.ts` が取る。 |
| セクションの責務 | 各セクションは自分の取得結果を props の `data` で受ける Server / Client Component。サーバーのデータを自分で取らない(取得は範囲の守りを通った loader が行う)。機能フラグ判定・表示制御を内包する。 |
| セクション登録 | 表示の対応表 `registry.ts`(配列順 = 表示順)と、取得の登録表 `services/server/sectionLoads.ts`(同じ id → load)。 |
| 並列データ取得 | `loadAdminDashboardData` が sectionLoads.ts の取得を並列に実行する。セクションを足しても Screen・loader は変わらない。 |
| 装飾の再利用 | `MetricCard` など共通カードは `components/parts/` に集約。 |

---

## ディレクトリ構造

```
src/features/core/admin/dashboard/
├── README.md                                # 本ドキュメント
├── index.ts                                 # 公開バレル
├── types.ts                                 # AdminDashboardSection 型
├── registry.ts                              # ★ 主要差し替え点(表示の対応表)
├── services/server/
│   ├── sectionLoads.ts                      # ★ 取得の登録表(id → load)
│   └── mainMetrics.ts                       # main-metrics の取得
└── components/
    ├── AdminDashboard.tsx                   # registry を render するだけのシン
    ├── sections/
    │   ├── MainMetricsSection.tsx           # サービスの稼働状況 (data で受ける)
    │   ├── AdditionalMetricsSection.tsx     # 追加の指標 (チャート)
    │   └── index.ts
    └── parts/
        ├── MetricCard.tsx                   # 装飾カード共通部品
        └── index.ts
```

---

## ダウンストリームでの拡張パターン

### 1. セクションを追加する

`components/sections/` に新規ファイルを作成し、`registry.ts` に append する。サーバーのデータが要るなら、取得を `services/server/` に書き、`services/server/sectionLoads.ts` に同じ id で載せる。

```tsx
// services/server/revenue.ts
export async function loadRevenue(): Promise<RevenueData | null> {
  if (!APP_FEATURES.adminConsole.dashboard.showRevenue) return null;
  return revenueService.getMonthlySummary();
}

// services/server/sectionLoads.ts に 1 行: "revenue": loadRevenue

// components/sections/RevenueSection.tsx
export function RevenueSection({ data }: AdminDashboardSectionProps<RevenueData | null>) {
  if (!data) return null;
  return (
    <Section id="revenue">
      <SecTitle>月次売上</SecTitle>
      {/* ... */}
    </Section>
  );
}
```

```ts
// registry.ts
export const adminDashboardSections: AdminDashboardSection[] = [
  defineDashboardSection("main-metrics", MainMetricsSection),
  defineDashboardSection("revenue", RevenueSection),        // 追加
  defineDashboardSection("additional-metrics", AdditionalMetricsSection),
];
```

Screen・loader も `AdminDashboard.tsx` も触らない。

### 2. セクションを削除する

`registry.ts` から該当行を削除する(取得があれば `sectionLoads.ts` の同じ id も)。

### 3. セクションを並べ替える

`registry.ts` の配列順を入れ替えるだけ。

### 4. ダッシュボードを丸ごと差し替える

`registry.ts` を全書き換えし、自前のセクションファイルを参照するだけ。
upstream の `page.tsx` / `AdminDashboard.tsx` には触らないため、upstream 側の
レイアウト変更 (PageTitle 仕様変更等) を取り込む際にコンフリクトしない。

### 5. セクションを Client Component で書きたい

セクションファイルの先頭に `"use client"` を書くだけ。registry の型は
sync / async いずれも受け付ける。Client セクションは server-only なサービスを import せず、
loader の data(シリアライズできる値)を受けるか、hook 経由でデータ取得する。

---

## セクションコンポーネントの実装規約

- **データは props の data で受ける**: サーバーのデータを自分で取らない(services/server・DB を import しない)。取得は `services/server/` に書き `sectionLoads.ts` に同じ id で載せる
- **null を返してよい**: 機能フラグ無効時等は取得側が null を返し、セクションは `return null` で消える
- **Section ラッパを使う**: 一貫した margin / 構造のため `<Section id="...">` で外側を包む
- **SecTitle で見出し**: セクションタイトルは `<SecTitle>...</SecTitle>` で揃える

---

## 機能フラグとの関係

`APP_FEATURES.adminConsole.dashboard.*` のフラグは **取得(services/server)か Section 内部で参照する**。
登録 / 解除のメカニズムは `registry.ts` に一本化されており、フラグはあくまで
「実装は残しつつ非表示にする」ための補助的手段として扱う。
完全に廃止する場合は registry から外す方が適切。

---

## 実装上の注意

- `registry.ts` は server セクションを import するため、Client Component から直接 import しないこと。
- `services/server/` の取得はセクション(UI)から import しない(型だけは可)。実行するのは AdminHome の loader だけ。
- `export const dynamic = "force-dynamic"` は `page.tsx` 側で維持する (現状維持済み)。
