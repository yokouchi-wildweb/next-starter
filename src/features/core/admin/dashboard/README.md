# Admin Dashboard ドメイン

管理画面トップページ (`/admin`) のダッシュボードを「セクション駆動」で構築するコアドメイン。
ダウンストリームでの **大規模な作り変え・部分差し替え** を最小コンフリクトで行えるよう、
page.tsx は薄いシェルに留め、内容は本ドメインの `registry.ts` で組み立てる構造を採用している。

---

## 設計思想

| 観点 | 採用 |
|------|------|
| ページ責務 | `app/admin/(protected)/page.tsx` はシェル (AdminPage + PageTitle + `<AdminDashboard />`) のみ。約10行。 |
| セクションの責務 | 各セクションは props を受け取らない自己完結 Server / Client Component。データ取得・機能フラグ判定・表示制御を内包する。 |
| セクション登録 | `registry.ts` の配列 1 つ。配列順 = 表示順。 |
| 並列データ取得 | 各セクションが async Server Component として独立して fetch するため、追加しても page.tsx の Promise.all を肥大化させない。 |
| 装飾の再利用 | `MetricCard` など共通カードは `components/parts/` に集約。 |

---

## ディレクトリ構造

```
src/features/core/admin/dashboard/
├── README.md                                # 本ドキュメント
├── index.ts                                 # 公開バレル
├── types.ts                                 # AdminDashboardSection 型
├── registry.ts                              # ★ 主要差し替え点
└── components/
    ├── AdminDashboard.tsx                   # registry を render するだけのシン
    ├── sections/
    │   ├── MainMetricsSection.tsx           # サービスの稼働状況 (async, userService)
    │   ├── AdditionalMetricsSection.tsx     # 追加の指標 (チャート)
    │   └── index.ts
    └── parts/
        ├── MetricCard.tsx                   # 装飾カード共通部品
        └── index.ts
```

---

## ダウンストリームでの拡張パターン

### 1. セクションを追加する

`components/sections/` に新規ファイルを作成し、`registry.ts` に append するだけ。

```tsx
// components/sections/RevenueSection.tsx
export async function RevenueSection() {
  if (!APP_FEATURES.adminConsole.dashboard.showRevenue) return null;
  const data = await revenueService.getMonthlySummary();
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
  { id: "main-metrics", Component: MainMetricsSection },
  { id: "revenue", Component: RevenueSection },        // 追加
  { id: "additional-metrics", Component: AdditionalMetricsSection },
];
```

`page.tsx` も `AdminDashboard.tsx` も触らない。

### 2. セクションを削除する

`registry.ts` から該当行を削除するだけ。

### 3. セクションを並べ替える

`registry.ts` の配列順を入れ替えるだけ。

### 4. ダッシュボードを丸ごと差し替える

`registry.ts` を全書き換えし、自前のセクションファイルを参照するだけ。
upstream の `page.tsx` / `AdminDashboard.tsx` には触らないため、upstream 側の
レイアウト変更 (PageTitle 仕様変更等) を取り込む際にコンフリクトしない。

### 5. セクションを Client Component で書きたい

セクションファイルの先頭に `"use client"` を書くだけ。registry の型は
sync / async いずれも受け付ける。Client セクション内では server-only なサービスを
直接 import せず、API ルート経由 (axios) でデータ取得する。

---

## セクションコンポーネントの実装規約

- **props を受け取らない**: 自己完結性を保つため、引数なしの関数として実装する
- **null を返してよい**: 機能フラグ無効時等は `return null` で消える
- **データ取得は内部で完結**: server セクションは直接 service を呼ぶ。client セクションは hook 経由
- **Section ラッパを使う**: 一貫した margin / 構造のため `<Section id="...">` で外側を包む
- **SecTitle で見出し**: セクションタイトルは `<SecTitle>...</SecTitle>` で揃える

---

## 機能フラグとの関係

`APP_FEATURES.adminConsole.dashboard.*` のフラグは **Section 内部で参照する**。
登録 / 解除のメカニズムは `registry.ts` に一本化されており、フラグはあくまで
「実装は残しつつ非表示にする」ための補助的手段として扱う。
完全に廃止する場合は registry から外す方が適切。

---

## 実装上の注意

- `registry.ts` は server セクションを import するため、間接的に server-only コードを含む。
  Client Component から直接 import しないこと。
- 新しいセクションが server-only な service を import する場合、必要に応じて
  `export const dynamic = "force-dynamic"` を `page.tsx` 側で維持する (現状維持済み)。
