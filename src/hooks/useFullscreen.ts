// src/hooks/useFullscreen.ts

"use client";

import { useCallback, useSyncExternalStore, type RefObject } from "react";

// iOS / 旧 Safari の webkit プレフィックス (ベストエフォート)
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenElement = Element & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const subscribeNoop = () => () => {};
const getServerFalse = () => false;

const subscribeFullscreenChange = (onStoreChange: () => void) => {
  if (typeof document === "undefined") return () => {};
  document.addEventListener("fullscreenchange", onStoreChange);
  document.addEventListener("webkitfullscreenchange", onStoreChange);
  return () => {
    document.removeEventListener("fullscreenchange", onStoreChange);
    document.removeEventListener("webkitfullscreenchange", onStoreChange);
  };
};

const getFullscreenElement = (): Element | null => {
  if (typeof document === "undefined") return null;
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
};

const getSupported = () => {
  if (typeof document === "undefined") return false;
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
};

export type FullscreenState = {
  /** 対象要素 (ref 未指定時はページ全体) が全画面表示中か */
  isFullscreen: boolean;
  /** Fullscreen API が利用可能か (SSR / iPhone Safari の非 video 要素などは false) */
  supported: boolean;
  /** 全画面に入る。成功 true / 非対応・拒否 false (throw しない) */
  enter: () => Promise<boolean>;
  /** 全画面を抜ける。成功 true / 未全画面・失敗 false */
  exit: () => Promise<boolean>;
  toggle: () => Promise<boolean>;
};

/**
 * Fullscreen API のトグルと状態を扱うフック。
 *
 * - `ref` を渡すとその要素、省略時は document.documentElement (ページ全体) が対象
 * - Esc キーやブラウザ UI での離脱も fullscreenchange 購読で isFullscreen に反映
 * - webkit プレフィックス (Safari) はベストエフォート対応。iPhone Safari は
 *   video 以外を全画面にできないため supported=false になる
 * - enter / exit は Promise<boolean> を返し失敗時も throw しない
 *   (ユーザー操作イベント外からの呼び出しはブラウザに拒否される → false)
 *
 * ```tsx
 * const stageRef = useRef<HTMLDivElement>(null);
 * const { isFullscreen, supported, toggle } = useFullscreen(stageRef);
 * return (
 *   <Block ref={stageRef}>
 *     {supported && <Button onClick={toggle}>{isFullscreen ? "全画面を終了" : "全画面"}</Button>}
 *   </Block>
 * );
 * ```
 */
export function useFullscreen(ref?: RefObject<Element | null>): FullscreenState {
  const supported = useSyncExternalStore(subscribeNoop, getSupported, getServerFalse);

  const getIsFullscreen = useCallback(() => {
    const current = getFullscreenElement();
    if (!current) return false;
    // ref 未指定 = ページ単位の関心: 何かが全画面なら true
    if (!ref) return true;
    return current === ref.current;
  }, [ref]);

  const isFullscreen = useSyncExternalStore(
    subscribeFullscreenChange,
    getIsFullscreen,
    getServerFalse,
  );

  const enter = useCallback(async () => {
    if (typeof document === "undefined") return false;
    const target = (ref?.current ?? document.documentElement) as FullscreenElement;
    const request = target.requestFullscreen ?? target.webkitRequestFullscreen;
    if (typeof request !== "function") return false;
    try {
      await request.call(target);
      return true;
    } catch {
      return false;
    }
  }, [ref]);

  const exit = useCallback(async () => {
    if (typeof document === "undefined") return false;
    if (!getFullscreenElement()) return false;
    const doc = document as FullscreenDocument;
    const exitFn = doc.exitFullscreen ?? doc.webkitExitFullscreen;
    if (typeof exitFn !== "function") return false;
    try {
      await exitFn.call(doc);
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggle = useCallback(async () => {
    // state ではなく実値で判定 (stale closure 回避)
    return getIsFullscreen() ? exit() : enter();
  }, [enter, exit, getIsFullscreen]);

  return { isFullscreen, supported, enter, exit, toggle };
}
