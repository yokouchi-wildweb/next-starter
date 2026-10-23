// stores/adminLayout/useStore.ts

"use client";

import { internalStore } from "./internalStore";

/**
 * AdminOuterLayout に追加クラスを適用するためのストア
 * 子コンポーネントから親レイアウトのスタイルを制御する用途
 */
export function useAdminLayoutStore() {
  const extraClassName = internalStore((s) => s.extraClassName);
  const setExtraClassName = internalStore((s) => s.setExtraClassName);

  return { extraClassName, setExtraClassName };
}
