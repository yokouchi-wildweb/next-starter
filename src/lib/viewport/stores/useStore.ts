// src/lib/viewport/stores/useStore.ts

"use client";

import { internalStore } from "./internalStore";

/** lib の中だけで使う(読み書き)。外へは useViewportSize(読むだけ)を出す */
export function useViewportSizeStore() {
  const width = internalStore((s) => s.width);
  const height = internalStore((s) => s.height);
  const setSize = internalStore((s) => s.setSize);
  return { width, height, setSize };
}
