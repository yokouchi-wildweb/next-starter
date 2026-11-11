// src/lib/globalLoader/stores/useStore.ts
// lib の中だけで使う(入口から出さない。外からは useGlobalLoader の showLoader / hideLoader で動かす)

"use client";

import { internalStore } from "./internalStore";

export function useGlobalLoaderStore() {
  const isVisible = internalStore((s) => s.isVisible);
  const options = internalStore((s) => s.options);
  const setVisible = internalStore((s) => s.setVisible);
  const setOptions = internalStore((s) => s.setOptions);

  return { isVisible, options, setVisible, setOptions };
}
