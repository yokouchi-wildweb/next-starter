// stores/viewportSize/useStore.ts

"use client";

import { internalStore } from "./internalStore";

export function useViewportSizeStore() {
  const width = internalStore((s) => s.width);
  const height = internalStore((s) => s.height);
  const setSize = internalStore((s) => s.setSize);
  return { width, height, setSize };
}
