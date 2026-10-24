// src/hooks/useIsClient.ts

"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * クライアントで描画できる状態かを返すフック。
 *
 * - SSR とハイドレーション中は false、ハイドレーション後は true を返す (hydration 不一致を起こさない)
 * - ハイドレーションを伴わないクライアント側のマウントでは最初の render から true
 * - `document.body` へのポータルや、サーバーとクライアントで出力が変わるライブラリ (@dnd-kit 等) を
 *   ハイドレーション後にだけ描画するために使う
 * - useEffect で `setMounted(true)` する書き方の置き換え (react-hooks/set-state-in-effect に掛からない)
 *
 * ```tsx
 * const isClient = useIsClient();
 * if (!isClient) return null;
 * return createPortal(children, document.body);
 * ```
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
