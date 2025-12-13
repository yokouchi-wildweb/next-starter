# 管理者コマンドパレット

管理者専用のコマンドパレット機能です。キーボードショートカットで素早くナビゲーションや設定変更を行えます。

## 概要

- **対象ユーザー**: `role: "admin"` のユーザーのみ
- **ショートカットキー**:
  - Windows/Linux: `Ctrl + Shift + Alt + A`
  - Mac: `Cmd + Shift + Option + A`
- **階層構造**: カテゴリ → アイテム の2階層メニュー

## 基本的な使い方

1. ショートカットキーでパレットを開く
2. カテゴリを選択（上下キー + Enter、またはクリック）
3. アイテムを選択して実行
4. `Backspace`（入力が空の時）で前のメニューに戻る
5. `Escape` でパレットを閉じる

検索は半角英数字のみ対応しています。カテゴリラベルに英数字キーワード（例: `navigate`, `config`）が含まれているため、英字入力で素早くフィルタリングできます。

---

## ディレクトリ構成

```
src/lib/adminCommand/
├── README.md                 # このファイル
├── index.ts                  # 公開エクスポート
├── types.ts                  # 型定義
├── categories.ts             # カテゴリ一覧（第1メニュー）
├── utils.ts                  # ユーティリティ関数
├── components/
│   ├── AdminCommandProvider.tsx  # Provider（ショートカット監視）
│   └── AdminCommandPalette.tsx   # パレット本体
└── definitions/              # カテゴリ定義
    ├── index.ts
    ├── navigation/           # ナビゲーションカテゴリ
    │   ├── index.ts
    │   ├── items.ts          # ナビゲーション先の定義
    │   └── NavigationRenderer.tsx
    └── settings/             # 設定変更カテゴリ
        ├── index.ts
        ├── items.ts          # 設定項目の定義
        └── SettingsRenderer.tsx
```

---

## セットアップ

`AdminCommandProvider` をアプリのルートレイアウトに配置してください。

```tsx
// app/layout.tsx
import { AdminCommandProvider } from "@/lib/adminCommand";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AdminCommandProvider>
          {children}
        </AdminCommandProvider>
      </body>
    </html>
  );
}
```

---

## カスタマイズ方法

### 1. ナビゲーション先を追加する

`definitions/navigation/items.ts` を編集します。

```tsx
// definitions/navigation/items.ts
import { LayoutDashboardIcon, UsersIcon } from "lucide-react";
import type { NavigationItem } from "../../types";

export const navigationItems: NavigationItem[] = [
  {
    id: "dashboard",
    label: "ダッシュボード (dashboard)",
    description: "管理画面トップ",
    icon: <LayoutDashboardIcon className="size-4" />,
    href: "/admin",
    keywords: ["home", "top", "管理"],  // 検索用キーワード（任意）
  },
  {
    id: "users",
    label: "ユーザー管理 (users)",
    href: "/admin/users",
    icon: <UsersIcon className="size-4" />,
  },
  // 新しいナビゲーション先を追加...
];
```

**NavigationItem の型:**

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | `string` | ✓ | 一意のID |
| `label` | `string` | ✓ | 表示ラベル（英数字キーワード推奨） |
| `href` | `string` | ✓ | 遷移先パス |
| `description` | `string` | - | 補足説明 |
| `icon` | `ReactNode` | - | アイコン |
| `keywords` | `string[]` | - | 検索用の追加キーワード |

---

### 2. 設定項目を追加する

`definitions/settings/items.ts` を編集します。

```tsx
// definitions/settings/items.ts
import type { SettingFieldConfig } from "../../types";

export const settingFields: SettingFieldConfig[] = [
  {
    key: "adminListPerPage",        // Setting エンティティのキー
    label: "一覧表示件数 (perpage)",
    description: "管理画面の一覧で1ページに表示する件数",
    type: "number",
    placeholder: "例: 20",
    validation: {
      min: 1,
      max: 100,
    },
  },
  {
    key: "adminFooterText",
    label: "フッターテキスト (footer)",
    type: "text",
    placeholder: "フッターに表示するテキスト",
    validation: {
      maxLength: 200,
    },
  },
  // 新しい設定項目を追加...
];
```

**SettingFieldConfig の型:**

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `key` | `string` | ✓ | Setting エンティティのプロパティ名 |
| `label` | `string` | ✓ | 表示ラベル |
| `type` | `"text"` \| `"number"` | ✓ | 入力タイプ |
| `description` | `string` | - | 補足説明 |
| `placeholder` | `string` | - | プレースホルダー |
| `validation` | `object` | - | バリデーション設定 |

**validation オプション:**

- `min`: 最小値（number のみ）
- `max`: 最大値（number のみ）
- `minLength`: 最小文字数（text のみ）
- `maxLength`: 最大文字数（text のみ）

---

### 3. 新しいカテゴリを追加する

より高度なカスタマイズとして、独自のカテゴリを追加できます。

#### Step 1: カテゴリ用フォルダを作成

```
definitions/
└── my-category/
    ├── index.ts
    └── MyCategoryRenderer.tsx
```

#### Step 2: レンダラーを実装

```tsx
// definitions/my-category/MyCategoryRenderer.tsx
"use client";

import { useCallback, useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/_shadcn/command";
import type { CategoryRendererProps } from "../../types";
import { filterSearchInput } from "../../utils";

export function MyCategoryRenderer({ onClose, onBack }: CategoryRendererProps) {
  const [searchValue, setSearchValue] = useState("");

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(filterSearchInput(value));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && searchValue === "") {
        e.preventDefault();
        onBack();
      }
    },
    [searchValue, onBack]
  );

  const handleAction = useCallback(() => {
    // アクションを実行
    onClose();
  }, [onClose]);

  return (
    <Command key="my-category">
      <div className="flex items-center gap-2 border-b">
        <button
          type="button"
          onClick={onBack}
          className="p-1 ml-2 hover:bg-accent rounded"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <CommandInput
          placeholder="検索..."
          value={searchValue}
          onValueChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          inputMode="email"
          autoFocus
        />
      </div>
      <CommandList>
        <CommandEmpty>項目が見つかりません</CommandEmpty>
        <CommandGroup heading="マイカテゴリ">
          <CommandItem onSelect={handleAction}>
            アクション1
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
```

#### Step 3: エクスポート

```tsx
// definitions/my-category/index.ts
export { MyCategoryRenderer } from "./MyCategoryRenderer";
```

```tsx
// definitions/index.ts
export { NavigationRenderer, navigationItems } from "./navigation";
export { SettingsRenderer, settingFields } from "./settings";
export { MyCategoryRenderer } from "./my-category";  // 追加
```

#### Step 4: カテゴリを登録

```tsx
// categories.ts
import { MyCategoryRenderer } from "./definitions/my-category";

export const categories: CategoryConfig[] = [
  // 既存のカテゴリ...
  {
    id: "my-category",
    label: "マイカテゴリ (mycategory)",
    description: "カスタム機能",
    Renderer: MyCategoryRenderer,
  },
];
```

---

## CategoryRendererProps

カスタムレンダラーが受け取る props:

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| `onClose` | `() => void` | パレットを閉じる |
| `onBack` | `() => void` | カテゴリ一覧に戻る |
| `user` | `SessionUser` | 現在のユーザー情報 |

---

## ユーティリティ関数

### filterSearchInput

検索入力を半角英数字のみにフィルタリングします。

```tsx
import { filterSearchInput } from "../../utils";

const handleSearchChange = (value: string) => {
  setSearchValue(filterSearchInput(value));
};
```

- 全角英数字を半角に変換（`ａｂｃ` → `abc`）
- 日本語文字を除去
- スペースは保持

---

## プログラムからパレットを開く

`useAdminCommand` フックを使用します。

```tsx
import { useAdminCommand } from "@/lib/adminCommand";

function MyComponent() {
  const { openPalette, closePalette, togglePalette, isOpen } = useAdminCommand();

  return (
    <button onClick={openPalette}>
      コマンドパレットを開く
    </button>
  );
}
```

---

## 注意事項

- このパレットは `role: "admin"` のユーザーにのみ表示されます
- ショートカットキーは他のアプリケーションと競合する可能性があります
- 設定変更は即座にデータベースに保存されます
