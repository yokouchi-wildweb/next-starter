// src/lib/globalLoader/stores/useStore.ts
// lib の中だけで使う(入口から出さない。外からは useGlobalLoader の showLoader と、それが返す終わりの関数で動かす)

"use client";

import { internalStore, type LoaderOptions } from "./internalStore";

const EMPTY: LoaderOptions = {};

/** 表示(1 つでも残る間)と、残っている中で最後に出した options */
export function useGlobalLoaderStore() {
  const isVisible = internalStore((s) => s.entries.length > 0);
  const options = internalStore((s) => s.entries[s.entries.length - 1]?.options ?? EMPTY);
  return { isVisible, options };
}

/** 出す・外すの関数(描画に関わらない) */
export function useGlobalLoaderActions() {
  const add = internalStore((s) => s.add);
  const remove = internalStore((s) => s.remove);
  return { add, remove };
}
