// stores/adminLayout/internalStore.ts

"use client";

import { create } from "zustand";

type AdminLayoutState = {
  /** 追加で適用するクラス名 */
  extraClassName: string | undefined;
  /** クラス名を設定 */
  setExtraClassName: (className: string | undefined) => void;
};

export const internalStore = create<AdminLayoutState>((set) => ({
  extraClassName: undefined,
  setExtraClassName: (className) => set({ extraClassName: className }),
}));
