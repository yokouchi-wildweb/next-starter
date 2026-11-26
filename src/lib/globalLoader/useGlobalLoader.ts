// src/lib/globalLoader/useGlobalLoader.ts

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGlobalLoaderActions, type LoaderOptions } from "./stores";

/**
 * グローバルローダーを出すフック。showLoader は終わりの関数を返す(D111・D114)。
 * - 呼んだ処理ごとに自分の分を持ち、全部の終わりが呼ばれるまで出し続ける(先に終わった処理が他の処理の表示を消さない)
 * - 文と見た目は、残っている中で最後に出した物
 * - 終わりの関数は 1 回だけ効く(2 回目以降は何もしない)。このフックを使う部品が unmount すると、その部品が出してまだ
 *   終わっていない分だけを外す
 *
 * @example
 * const { showLoader } = useGlobalLoader();
 *
 * const end = showLoader("ガチャ準備中…");
 * try {
 *   await draw();
 * } finally {
 *   end();
 * }
 */
export function useGlobalLoader() {
  const { add, remove } = useGlobalLoaderActions();
  /** この部品が出してまだ終わっていない手形 */
  const owned = useRef(new Set<number>());

  useEffect(() => {
    const ids = owned.current;
    return () => {
      for (const id of ids) remove(id);
      ids.clear();
    };
  }, [remove]);

  const showLoader = useCallback(
    (options?: string | LoaderOptions): (() => void) => {
      const resolved: LoaderOptions = typeof options === "string" ? { message: options } : (options ?? {});
      const id = add(resolved);
      owned.current.add(id);
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        owned.current.delete(id);
        remove(id);
      };
    },
    [add, remove],
  );

  return { showLoader };
}
