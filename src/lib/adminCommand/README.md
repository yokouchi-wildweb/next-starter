# 管理者コマンドパレット

管理者専用のコマンドパレット機能です。キーボードショートカットで素早くナビゲーションや設定変更を行えます。

## 概要

- **対象ユーザー**: `role: "admin"` のユーザーのみ
- **ショートカットキー**:
  - Windows/Linux: `Ctrl + Shift + Alt + A`
  - Mac: `Cmd + Shift + Option + A`
- **階層構造**: カテゴリ → アイテム の2階層メニュー

### ショートカットキー押下時の動作

| 状態 | 動作 |
|------|------|
| 管理者でログイン中 | コマンドパレットを表示 |
| ログインしていない / 管理者でない | `/admin/login` に遷移 |

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
├── README.md
├── index.ts                  # 公開エクスポート
├── types.ts                  # definitions用の型定義
├── utils.ts                  # ユーティリティ関数
│
├── core/                     # 🔒 コア（編集禁止）
│   ├── index.ts
│   ├── types.ts              # コア型定義
│   ├── context.ts            # Context定義
│   ├── AdminCommandProvider.tsx
│   └── AdminCommandPalette.tsx
│
├── config/                   # ✏️ 設定ファイル（編集可能）
│   ├── index.ts
│   ├── categories.ts         # カテゴリ登録
│   └── plugins.ts            # プラグイン登録
│
└── definitions/              # ✏️ カテゴリ実装（編集可能）
    ├── index.ts
    ├── navigation/
    │   ├── index.ts
    │   ├── items.ts
    │   └── NavigationRenderer.tsx
    └── settings/
        ├── index.ts
        ├── items.ts
        └── SettingsRenderer.tsx
```

### 編集ルール

| ディレクトリ | 編集可否 | 用途 |
|-------------|---------|------|
| `core/` | ❌ 禁止 | コア機能（変更するとライブラリが壊れる可能性） |
| `config/` | ✅ 可能 | カテゴリ登録、プラグイン登録 |
| `definitions/` | ✅ 可能 | カテゴリの実装 |

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
import type { NavigationItem } from "../../types";

export const navigationItems: NavigationItem[] = [
  {
    id: "dashboard",
    label: "ダッシュボード (dashboard)",
    description: "管理画面トップ",
    href: "/admin",
    keywords: ["home", "top"],
  },
  // 新しいナビゲーション先を追加...
];
```

---

### 2. 設定項目を追加する

`definitions/settings/items.ts` を編集します。

```tsx
// definitions/settings/items.ts
import type { SettingFieldConfig } from "../../types";

export const settingFields: SettingFieldConfig[] = [
  {
    key: "adminListPerPage",
    label: "一覧表示件数 (perpage)",
    type: "number",
    validation: { min: 1, max: 100 },
  },
  // 新しい設定項目を追加...
];
```

---

### 3. 新しいカテゴリを追加する

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
import type { CategoryRendererProps } from "../../core/types";
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

  return (
    <Command key="my-category">
      <div className="flex items-center gap-2 border-b">
        <button type="button" onClick={onBack} className="p-1 ml-2 hover:bg-accent rounded">
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
          <CommandItem onSelect={() => { /* 処理 */ onClose(); }}>
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

#### Step 4: カテゴリを登録

```tsx
// config/categories.ts
import { MyCategoryRenderer } from "../definitions/my-category";

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

## プラグインシステム

カテゴリに **Provider**（状態管理）や **GlobalComponent**（パレット外UI）が必要な場合、プラグインとして登録します。

### プラグインの登録

```tsx
// config/plugins.ts
import type { AdminCommandPlugin } from "../core/types";
import { StatusChangeProvider, StatusChangeDialog } from "../definitions/status-change";

export const plugins: AdminCommandPlugin[] = [
  {
    id: "status-change",
    Provider: StatusChangeProvider,       // カテゴリ固有の状態管理
    GlobalComponent: StatusChangeDialog,  // パレット外で常時表示するUI
  },
];
```

### AdminCommandPlugin の型

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | `string` | ✓ | プラグインID（カテゴリIDと一致させることを推奨） |
| `Provider` | `ComponentType<{ children: ReactNode }>` | - | カテゴリ固有のProvider |
| `GlobalComponent` | `ComponentType` | - | パレット外で常時表示するコンポーネント |

### 使用例: ステータス変更機能

```
definitions/
└── status-change/
    ├── index.ts
    ├── StatusChangeRenderer.tsx    # パレット内UI
    ├── StatusChangeProvider.tsx    # 状態管理（Context）
    ├── StatusChangeDialog.tsx      # 確認ダイアログ（パレット外）
    └── useStatusChange.ts          # カスタムフック
```

**Provider の実装例:**

```tsx
// definitions/status-change/StatusChangeProvider.tsx
"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type StatusChangeContextValue = {
  targetId: string | null;
  setTargetId: (id: string | null) => void;
  isDialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
};

const StatusChangeContext = createContext<StatusChangeContextValue | null>(null);

export function useStatusChange() {
  const ctx = useContext(StatusChangeContext);
  if (!ctx) throw new Error("useStatusChange must be used within StatusChangeProvider");
  return ctx;
}

export function StatusChangeProvider({ children }: { children: ReactNode }) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <StatusChangeContext.Provider
      value={{
        targetId,
        setTargetId,
        isDialogOpen,
        openDialog: () => setIsDialogOpen(true),
        closeDialog: () => setIsDialogOpen(false),
      }}
    >
      {children}
    </StatusChangeContext.Provider>
  );
}
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
- **`core/` ディレクトリ内のファイルは編集しないでください**
