# 管理者コマンドパレット

管理者専用のコマンドパレット機能。`Ctrl + Shift + Alt + A`（Mac: `Cmd + Shift + Option + A`）で起動。

---

## 足し方

fork は上流のファイルを編集せず、受け口にファイルを置いて `pnpm extensions:generate`(仕組み: `scripts/extensions/README.md`)。

| 足すもの | 置き場 |
|---|---|
| カテゴリ | `src/app/_layout/adminCommand/categories/<名前>[.<fork の名前>].tsx` の `export const category`(並びはファイル名の順) |
| Provider・GlobalComponent | `src/app/_layout/adminCommand/plugins/<名前>[.<fork の名前>].tsx` の `export const plugin` |
| ナビゲーション先 | `src/features/core/adminCommand/navigationItems/<名前>[.<fork の名前>].ts` の `export const items`(配列) |

カテゴリとプラグインは管理者のときだけ読み込む(`load: lazy`)。一般の利用者には届かない。

---

## ディレクトリ構成

```
src/app/_layout/adminCommand/     # 画面側の点
├── extensionPoints.ts
├── categories/                   # カテゴリの項目
├── plugins/                      # プラグインの項目
└── extensions/                   # 生成物

src/features/core/adminCommand/
├── base/                         # Provider・パレット(上流)
├── definitions/                  # 上流のカテゴリの実装
├── navigationItems/              # ナビゲーション先の項目
└── extensions/                   # 生成物
```

---

## クイックスタート

### ナビゲーション先を追加する

`navigationItems/<名前>.<fork の名前>.ts`:

```ts
import type { NavigationItemGroup } from "@/features/core/adminCommand/types";

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

### 設定項目を追加する

`definitions/settings/items.ts` に追記：

```tsx
{
  key: "mySettingKey",        // Setting モデルのフィールド名
  label: "設定名 (setting)",
  type: "number",             // "text" | "number"
  validation: { min: 1, max: 100 },
}
```

---

## 新しいカテゴリを追加する

### Step 1: フォルダ作成

```
src/features/<ドメイン>/components/<カテゴリ>/
├── index.ts
├── MyCategoryRenderer.tsx
└── items.ts（任意）
```

### Step 2: レンダラー実装

既存の `definitions/navigation/NavigationRenderer.tsx` を参考に実装。

**必須要素:**
- `Command` コンポーネントに `key` を指定
- `CommandInput` に `autoFocus` を指定
- Backspaceで戻る処理（`searchValue === ""` の時に `onBack()` を呼ぶ）

### Step 3: 登録

`src/app/_layout/adminCommand/categories/myCategory.<fork の名前>.tsx`:

```tsx
import type { CategoryConfig } from "@/features/core/adminCommand/base/types";
import { MyCategoryRenderer } from "@/features/myDomain/components/MyCategoryRenderer";

export const category: CategoryConfig = {
  id: "my-category",
  label: "マイカテゴリ (mycategory)",
  description: "カスタム機能",
  Renderer: MyCategoryRenderer,
};
```

---

## プラグインシステム（応用）

カテゴリに **Provider**（状態管理）や **GlobalComponent**（パレット外UI）が必要な場合に使用。

### 登録方法

`src/app/_layout/adminCommand/plugins/myCategory.<fork の名前>.tsx`:

```tsx
import type { AdminCommandPlugin } from "@/features/core/adminCommand/base/types";

export const plugin: AdminCommandPlugin = {
  id: "my-category",                    // カテゴリIDと一致推奨
  Provider: MyCategoryProvider,         // 状態管理が必要な場合
  GlobalComponent: MyCategoryDialog,    // パレット外UIが必要な場合
};
```

Provider が包むのはパレットと GlobalComponent だけ(管理者になってから読み込むため、画面全体は包まない)。

### 使用例

パレット内でアクションを選択 → 確認ダイアログを表示 → 実行

```
src/features/<ドメイン>/components/<カテゴリ>/
├── MyCategoryRenderer.tsx    # パレット内UI
├── MyCategoryProvider.tsx    # 状態管理（Context）
├── MyCategoryDialog.tsx      # 確認ダイアログ
└── useMyCategoryAction.ts    # カスタムフック
```

Providerでダイアログの開閉状態を管理し、GlobalComponentでダイアログを描画。

---

## リファレンス

### CategoryRendererProps

レンダラーが受け取る props：

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `onClose` | `() => void` | パレットを閉じる |
| `onBack` | `() => void` | カテゴリ一覧に戻る |
| `user` | `SessionUser` | 現在のユーザー情報 |

### 型定義

| 型 | インポート元 | 用途 |
|----|-------------|------|
| `CategoryRendererProps` | `@/features/core/adminCommand/base/types` | レンダラーのprops |
| `CategoryConfig` | `@/features/core/adminCommand/base/types` | カテゴリ設定 |
| `AdminCommandPlugin` | `@/features/core/adminCommand/base/types` | プラグイン設定 |
| `NavigationItem` | `@/features/core/adminCommand/types` | ナビゲーション項目 |
| `SettingFieldConfig` | `@/features/core/adminCommand/types` | 設定項目 |

### ユーティリティ

```tsx
import { filterSearchInput } from "@/features/core/adminCommand/utils";

// 検索入力を半角英数字のみにフィルタリング
const handleSearchChange = (value: string) => {
  setSearchValue(filterSearchInput(value));
};
```

### プログラムからパレットを開く

```tsx
import { useAdminCommand } from "@/features/core/adminCommand";

const { openPalette, closePalette, togglePalette, isOpen } = useAdminCommand();
```

---

## 付録：エンドユーザー向け情報

### ショートカットキー

| OS | キー |
|----|------|
| Windows/Linux | `Ctrl + Shift + Alt + A` |
| Mac | `Cmd + Shift + Option + A` |

### 操作方法

1. ショートカットキーでパレットを開く
2. カテゴリを選択（↑↓ + Enter）
3. アイテムを選択して実行
4. `Backspace`（入力が空の時）で戻る
5. `Escape` で閉じる

### ログインしていない場合

ショートカットキーを押すと `/admin/login` に遷移します。
