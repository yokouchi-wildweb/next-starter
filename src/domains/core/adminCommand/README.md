# 管理者コマンドパレット

## Overview

- 管理者専用のコマンドパレット。`Ctrl + Shift + Alt + A`（Mac: `Cmd + Shift + Option + A`）で開く
- 操作: カテゴリを選ぶ（↑↓ + Enter）→ アイテムを選んで実行 | `Backspace` / `←`（入力が空の時）で戻る | `Escape` で閉じる
- ログインしていない時にショートカットを押すと `/admin/login` に移る
- プログラムから開く: `useAdminCommand()`（`@/domains/core/adminCommand`）の `openPalette` / `closePalette` / `togglePalette` / `isOpen`

## Usage

### ナビゲーション先を足す

`src/domains/core/adminCommand/navigationItems/<名前>.ts` を置き、`pnpm generate extensions`:

```ts
import type { NavigationItemGroup } from "@/domains/core/adminCommand/types";

export const items: NavigationItemGroup = [
  {
    id: "my-page",
    label: "マイページ (mypage)",
    description: "マイページに移動",
    href: "/admin/my-page",
    keywords: ["my", "page"],
  },
];
```

### カテゴリを足す

1. 部品の置き場: 自分のドメインの `src/domains/<ドメイン>/components/<カテゴリ>/`（`index.ts`・`<カテゴリ>Renderer.tsx`・任意で `items.ts`）
2. レンダラー: `definitions/navigation/NavigationRenderer.tsx` が手本。`Command` の `key`・`CommandInput` の `autoFocus`・入力が空の時の Backspace で `onBack()`
3. 登録: `src/app/_layout/adminCommand/categories/<名前>.tsx` を置き、`pnpm generate extensions`

```tsx
import type { CategoryConfig } from "@/domains/core/adminCommand/base/types";
import { MyCategoryRenderer } from "@/domains/myDomain/components/MyCategoryRenderer";

export const category: CategoryConfig = {
  id: "my-category",
  label: "マイカテゴリ (mycategory)",
  description: "カスタム機能",
  Renderer: MyCategoryRenderer,
};
```

### プラグイン（Provider・GlobalComponent）

カテゴリに状態（Provider）やパレットの外の UI（GlobalComponent）が要る時に使う。`src/app/_layout/adminCommand/plugins/<名前>.tsx`:

```tsx
import type { AdminCommandPlugin } from "@/domains/core/adminCommand/base/types";

export const plugin: AdminCommandPlugin = {
  id: "my-category",                    // カテゴリIDと一致推奨
  Provider: MyCategoryProvider,         // 状態管理が必要な場合
  GlobalComponent: MyCategoryDialog,    // パレット外UIが必要な場合
};
```

- 使い方の例: パレットでアクションを選ぶ → 確認ダイアログ → 実行。Provider がダイアログの開閉を持ち、GlobalComponent がダイアログを描く（部品はカテゴリと同じフォルダに Renderer・Provider・Dialog・フック）

### 設定項目（上流）

上流の設定カテゴリの項目は `definitions/settings/items.ts`:

```tsx
{
  key: "mySettingKey",        // Setting モデルのフィールド名
  label: "設定名 (setting)",
  type: "number",             // "text" | "number"
  validation: { min: 1, max: 100 },
}
```

### 検索入力の絞り

```tsx
import { filterSearchInput } from "@/domains/core/adminCommand/utils";

// 検索入力を半角英数字のみにフィルタリング
const handleSearchChange = (value: string) => {
  setSearchValue(filterSearchInput(value));
};
```

## API

### CategoryRendererProps

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `onClose` | `() => void` | パレットを閉じる |
| `onBack` | `() => void` | カテゴリ一覧に戻る |
| `user` | `SessionUser` | 現在のユーザー情報 |

### 型

| 型 | インポート元 | 用途 |
|----|-------------|------|
| `CategoryRendererProps` | `@/domains/core/adminCommand/base/types` | レンダラーのprops |
| `CategoryConfig` | `@/domains/core/adminCommand/base/types` | カテゴリ設定 |
| `AdminCommandPlugin` | `@/domains/core/adminCommand/base/types` | プラグイン設定 |
| `NavigationItem` | `@/domains/core/adminCommand/types` | ナビゲーション項目 |
| `SettingFieldConfig` | `@/domains/core/adminCommand/types` | 設定項目 |

## Extension

受け口にファイルを置いて `pnpm generate extensions`（仕組み: `scripts/structure/extensions/README.md`）。

| 足すもの | 置き場 |
|---|---|
| カテゴリ | `src/app/_layout/adminCommand/categories/<名前>.tsx` の `export const category`（並びはファイル名の順） |
| Provider・GlobalComponent | `src/app/_layout/adminCommand/plugins/<名前>.tsx` の `export const plugin` |
| ナビゲーション先 | `src/domains/core/adminCommand/navigationItems/<名前>.ts` の `export const items`（配列） |

- カテゴリとプラグインは管理者のときだけ読み込む（`load: lazy`）。一般の利用者には届かない
- React の受け口の置き場 `src/app/_layout/adminCommand/` の `AdminCommandRoot.tsx`（client）が一覧を Provider に結ぶ（`load` は関数なのでサーバーから渡せない）

## Internals

### 閉じた機能の候補を隠す（門番）

- 語: 門番 = feature gate（`useGate()`）| 管理の枠 = admin の守りの layout が敷く門番の値 | 利用者の枠 = root の門番の値 | 橋 = `AdminCommandGateBridge` | 棚の Link = 門番を見る共通の Link
- ナビゲーション先の候補は、管理の枠の門番の厳密な `useGate().path`（管理メニューと同じ判定）で絞る
  - 閉じた機能の住所を指す行は `redirectTo` の有無に関わらず出ない（`?` と `#` の後ろは照合から外す）
  - 外部 URL・`/` で始まらない住所・開いた住所は残る。fork が足す行も同じ
- パレットはアプリ全体（`src/wiring/AppProviders.tsx`、利用者の枠の門番の内）に置かれ、管理の枠の値は admin の守りの layout（`src/app/admin/(protected)/layout.tsx`）が children だけを包む
  - そこに置いた橋 `AdminCommandGateBridge` が絞り込みを Context（`navigationFilter`）に登録し、外れたら外す
- 管理の枠の外（利用者の画面）で開いたときは絞らず、候補をそのまま出す（棚の Link と同じ。移動の先が閉じていれば proxy が 404）

### プラグインの包む範囲

- Provider が包むのはパレットと GlobalComponent だけ（管理者になってから読み込むため）

## Verification

- 門番の絞り込み: `pnpm test src/domains/core/adminCommand/base/navigationGate.test.tsx`
