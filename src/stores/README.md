# Stores

Zustand を使用した状態管理ストアの配置場所。

## 方針

### ストアの責務

- **状態保持のみに限定する**
- ビジネスロジックは置かない（`services/` で実装）
- UI副作用（DOM操作、初期化など）はフック内の `useEffect` で処理

### ディレクトリ構造

各ストアは**必ずサブディレクトリ**を作成し、以下の構成とする。

```
stores/
  appToast/
    index.ts           ← re-export（公開インターフェース）
    internalStore.ts   ← ストア本体（直接使用禁止）
    useStore.ts        ← 基本フック
  siteTheme/
    index.ts
    internalStore.ts
    useStore.ts
```

### ファイルの役割

| ファイル | 役割 | 直接使用 |
|---|---|---|
| `internalStore.ts` | Zustand ストア定義（状態 + アクション） | ✗ 禁止 |
| `useStore.ts` | ストアへの基本アクセスフック | ○ |
| `index.ts` | 公開する要素の re-export | - |
| `types.ts` | 型定義（任意、複雑なストア向け） | - |

### 型定義の分離（任意）

型定義が多い場合や外部から多用される場合は、`types.ts` に分離してもよい。

```
stores/appToast/
  index.ts
  types.ts           ← 型定義（任意）
  internalStore.ts   ← types.ts を import
  useStore.ts
```

**分離の目安:**
- 型定義が5個以上
- 型を外部コンポーネントから多用する

### 階層

```
internalStore（内部実装、直接使用禁止）
      ↓ 使用
useStore（基本アクセス）
      ↓ 使用（必要に応じて）
hooks/useXxx（機能拡張フック）
```

---

## 実装例

### internalStore.ts

```typescript
// stores/appToast/internalStore.ts
"use client";

import { create } from "zustand";

export type AppToastVariant = "success" | "error" | "warning" | "info";

export type AppToastOptions = {
  message: string;
  variant?: AppToastVariant;
};

type AppToastState = {
  toast: AppToastOptions | null;
  show: (options: AppToastOptions) => void;
  hide: () => void;
};

export const internalStore = create<AppToastState>((set) => ({
  toast: null,
  show: (options) => set({ toast: options }),
  hide: () => set({ toast: null }),
}));
```

### useStore.ts

```typescript
// stores/appToast/useStore.ts
"use client";

import { internalStore } from "./internalStore";

export function useAppToastStore() {
  const toast = internalStore((s) => s.toast);
  const show = internalStore((s) => s.show);
  const hide = internalStore((s) => s.hide);

  return { toast, show, hide };
}
```

### index.ts

```typescript
// stores/appToast/index.ts
export { useAppToastStore } from "./useStore";
export type { AppToastOptions, AppToastVariant } from "./internalStore";
// internalStore 自体は export しない
```

### 機能拡張フック（hooks/ に配置）

```typescript
// hooks/useAppToast.ts
"use client";

import { useCallback } from "react";
import { useAppToastStore } from "@/stores/appToast";

export function useAppToast() {
  const { show, hide } = useAppToastStore();

  // ショートハンド提供
  const showSuccess = useCallback(
    (message: string) => show({ message, variant: "success" }),
    [show]
  );

  const showError = useCallback(
    (message: string) => show({ message, variant: "error" }),
    [show]
  );

  return { showSuccess, showError, hide };
}
```

---

## 使用ルール

| 使用場所 | 使用可能 | 使用禁止 |
|---|---|---|
| `stores/*/useStore.ts` | `internalStore` | - |
| `hooks/useXxx.ts` | `useStore` | `internalStore` |
| コンポーネント | `useStore` または `hooks/useXxx` | `internalStore` |

---

## 禁止事項

- `internalStore` を直接コンポーネントや `hooks/` から使用する
- ストアにビジネスロジックを置く（API呼び出し、データ変換、バリデーション等）
- サブディレクトリを作らずにルート直下にファイルを置く
