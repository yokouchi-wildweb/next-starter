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
  siteTheme/
    index.ts           ← re-export（公開インターフェース）
    internalStore.ts   ← ストア本体（直接使用禁止）
    useStore.ts        ← 基本フック
```

> 💡 トースト機能は `lib/toast/` ライブラリに移行済み。以下の実装例は一般的なパターンを示す。

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
// stores/siteTheme/internalStore.ts
"use client";

import { create } from "zustand";

type ThemeState = {
  isDark: boolean;          // 初期値は SSR と一致させるため false 固定(SiteThemeSync が同期する)
  areaKey: string | null;   // <html data-area>
  synced: boolean;
  setResolved: (next: { isDark: boolean; areaKey: string }) => void;
  setDark: (isDark: boolean) => void;
};

export const internalStore = create<ThemeState>((set) => ({
  isDark: false,
  areaKey: null,
  synced: false,
  setResolved: ({ isDark, areaKey }) => set({ isDark, areaKey, synced: true }),
  setDark: (isDark) => set({ isDark }),
}));
```

### useStore.ts

状態を返すフックと、副作用(DOM 同期)を持つ常駐フックを同じファイルに置く。
internalStore を触るのはこのファイルだけ。

```typescript
// stores/siteTheme/useStore.ts
"use client";

import { internalStore } from "./internalStore";
import { applyThemeToDom, persistThemePreference, readThemeFromDom, resolveCurrentSiteTheme } from "@/utils/siteTheme";

// 状態 + 切替操作(保存は利用者の操作時だけ。ロックされたエリアでは no-op)
export function useSiteThemeStore() {
  const isDark = internalStore((s) => s.isDark);
  const areaKey = internalStore((s) => s.areaKey);
  const setDarkState = internalStore((s) => s.setDark);
  const switchable = getSiteThemeAreaByKey(SITE_THEME_CONFIG, areaKey).switchable;
  const setDark = (next: boolean) => { if (!switchable) return; setDarkState(next); persistThemePreference(next); };
  const toggle = () => setDark(!readThemeFromDom());
  return { isDark, areaKey, switchable, toggle, setDark };
}

// 常駐(SiteThemeSync が 1 箇所で呼ぶ): パス遷移ごとに再解決し、毎描画で store の値を DOM に反映する
// (root layout の RSC 再描画で React が <html className> を SSR 近似値に戻すのを同じ commit 内で上書きするため、
//  依存配列なしの useLayoutEffect。初回同期前は書かない)
export function useSiteThemeSync() {
  /* useEffect: usePathname → resolveCurrentSiteTheme → setResolved(+ OS 設定変化の購読)
     useLayoutEffect(依存なし): synced なら applyThemeToDom(isDark, areaKey) */
}
```

### index.ts

```typescript
// stores/siteTheme/index.ts
export { useSiteThemeStore, useSiteThemeSync } from "./useStore";
// internalStore 自体は export しない
```

実装の全体像(SSR / bootstrap script / SiteThemeSync の役割分担)は `src/styles/README.md` を参照。

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
