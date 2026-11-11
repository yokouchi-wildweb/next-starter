// src/lib/viewport/stores/internalStore.ts

"use client";

import { create } from "zustand";

export type ViewportSizeState = {
  width: number;
  height: number;
  setSize: (width: number, height: number) => void;
};

// 書くのは ViewportHeightWatcher だけ(書き手は 1 つ)。lib の外へは出さない
export const internalStore = create<ViewportSizeState>((set) => ({
  width: 0,
  height: 0,
  setSize: (width, height) => set({ width, height }),
}));
