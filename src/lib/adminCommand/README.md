# 管理者コマンドパレット

管理者専用のコマンドパレット機能。`Ctrl + Shift + Alt + A`（Mac: `Cmd + Shift + Option + A`）で起動。

---

## 編集ルール（最重要）

| ディレクトリ | 編集 | 用途 |
|-------------|:----:|------|
| `core/` | ❌ | コア機能（編集禁止） |
| `config/` | ✅ | カテゴリ・プラグインの登録 |
| `definitions/` | ✅ | カテゴリの実装 |

**拡張時は `config/` と `definitions/` のみ編集してください。**

---

## ディレクトリ構成

```
src/lib/adminCommand/
├── core/                     # 🔒 編集禁止
│   └── ...
│
├── config/                   # ✏️ 登録ファイル
│   ├── categories.ts         # カテゴリ登録
│   └── plugins.ts            # プラグイン登録
│
└── definitions/              # ✏️ カテゴリ実装
    ├── navigation/           # ナビゲーション（参考実装）
    └── settings/             # 設定変更（参考実装）
```

---

## クイックスタート

### ナビゲーション先を追加する

`definitions/navigation/items.ts` に追記：

```tsx
{
  id: "my-page",
  label: "マイページ (mypage)",
  description: "マイページに移動",
  href: "/admin/my-page",
  keywords: ["my", "page"],
}
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
definitions/my-category/
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

`config/categories.ts` に追記：

```tsx
import { MyCategoryRenderer } from "../definitions/my-category";

// categories 配列に追加
{
  id: "my-category",
  label: "マイカテゴリ (mycategory)",
  description: "カスタム機能",
  Renderer: MyCategoryRenderer,
}
```

---

## プラグインシステム（応用）

カテゴリに **Provider**（状態管理）や **GlobalComponent**（パレット外UI）が必要な場合に使用。

### 登録方法

`config/plugins.ts` に追記：

```tsx
{
  id: "my-category",                    // カテゴリIDと一致推奨
  Provider: MyCategoryProvider,         // 状態管理が必要な場合
  GlobalComponent: MyCategoryDialog,    // パレット外UIが必要な場合
}
```

### 使用例

パレット内でアクションを選択 → 確認ダイアログを表示 → 実行

```
definitions/my-category/
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
| `CategoryRendererProps` | `../../core/types` | レンダラーのprops |
| `CategoryConfig` | `../../core/types` | カテゴリ設定 |
| `AdminCommandPlugin` | `../../core/types` | プラグイン設定 |
| `NavigationItem` | `../../types` | ナビゲーション項目 |
| `SettingFieldConfig` | `../../types` | 設定項目 |

### ユーティリティ

```tsx
import { filterSearchInput } from "../../utils";

// 検索入力を半角英数字のみにフィルタリング
const handleSearchChange = (value: string) => {
  setSearchValue(filterSearchInput(value));
};
```

### プログラムからパレットを開く

```tsx
import { useAdminCommand } from "@/lib/adminCommand";

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
