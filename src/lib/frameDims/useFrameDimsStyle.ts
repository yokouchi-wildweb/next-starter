// src/lib/frameDims/useFrameDimsStyle.ts

"use client";

import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";

import { frameDimsConfig, type FrameDimsConfig, type FrameDimVar } from "./config";
import { currentFrameRoot, subscribeFrameRoots } from "./frameRoot";

/** 部位の名前(設定の vars のキー: header / app-banner / bottom-nav) */
export type FrameDimPart = keyof FrameDimsConfig["vars"];

/** 枠の寸法変数を写した style(外枠に書かれている変数だけを持つ) */
export type FrameDimsStyle = CSSProperties & { [K in FrameDimVar]?: string };

const EMPTY_STYLE: FrameDimsStyle = Object.freeze({});

type ReadStyle = (element: Element) => { getPropertyValue(name: string): string };

/**
 * 外枠の寸法変数の計算値を style に写す(純関数。hook の中身と test 用)。外枠が無い時(登録が無い = 枠の外のページ)は空。
 * 外枠 = 枠が useFrameRootRef で登録した要素(./frameRoot.ts)。変数の名前は設定(config.ts、上書き = src/config/lib/frameDims.config.ts)。
 * 隠している部位の変数は、隠す側の CSS が 0 にした計算値をそのまま写す(何が 0 にしたかは見ない)。
 */
export function readFrameDimsStyle(
  frameRoot: Element | null,
  readStyle: ReadStyle,
  dims: FrameDimsConfig = frameDimsConfig,
): FrameDimsStyle {
  if (!frameRoot) return EMPTY_STYLE;
  const computed = readStyle(frameRoot);
  const style: FrameDimsStyle = {};
  for (const name of Object.values(dims.vars)) {
    const value = computed.getPropertyValue(name).trim();
    if (value) style[name] = value;
  }
  return style;
}

let cache: { key: string; style: FrameDimsStyle } = { key: "", style: EMPTY_STYLE };

function getSnapshot(): FrameDimsStyle {
  const style = readFrameDimsStyle(currentFrameRoot(), (element) => getComputedStyle(element));
  const key = JSON.stringify(style);
  if (key !== cache.key) cache = { key, style };
  return cache.style;
}

const getServerSnapshot = () => EMPTY_STYLE;

/**
 * 外枠を見る MutationObserver の指定。1 回の observe にまとめる: 同じ要素へ observe を 2 回呼ぶと 2 回目の指定が 1 回目を
 * 置き換え、外枠の属性だけの変化(inline の --app-header-height・隠す宣言の属性)を拾わなくなる
 */
export const FRAME_OBSERVE_OPTIONS: MutationObserverInit = Object.freeze({ attributes: true, childList: true, subtree: true });

type SubscribeEnv = {
  /** 今の外枠(登録した物) */
  getRoot: () => Element | null;
  /** 登録の出入りを見る */
  subscribeRoots: (listener: () => void) => () => void;
  win: Pick<Window, "addEventListener" | "removeEventListener" | "requestAnimationFrame" | "cancelAnimationFrame">;
  createObserver: (callback: () => void) => Pick<MutationObserver, "observe" | "disconnect">;
};

/**
 * 外枠の中の変化(印の出入り・部品の差し替え)・外枠の属性(inline の寸法・隠す宣言)・画面幅(デバイスの境目)・登録の出入り
 * (枠の mount・unmount)を見て、1 フレームに 1 回だけ読み直す。外枠が替われば observer を付け直す。
 * 登録・window・observer は渡す(test が DOM の道具なしで確かめる)
 */
export function subscribeFrameDims(onChange: () => void, { getRoot, subscribeRoots, win, createObserver }: SubscribeEnv): () => void {
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      onChange();
    });
  };
  let observed: Element | null = null;
  let observer: Pick<MutationObserver, "observe" | "disconnect"> | null = null;
  const watch = () => {
    const root = getRoot();
    if (root === observed) return;
    observer?.disconnect();
    observer = null;
    observed = root;
    if (root) {
      observer = createObserver(schedule);
      observer.observe(root, FRAME_OBSERVE_OPTIONS);
    }
  };
  watch();
  const unsubscribeRoots = subscribeRoots(() => {
    watch();
    schedule();
  });
  win.addEventListener("resize", schedule);
  return () => {
    unsubscribeRoots();
    observer?.disconnect();
    win.removeEventListener("resize", schedule);
    if (frame) win.cancelAnimationFrame(frame);
  };
}

const subscribe = (onChange: () => void) =>
  subscribeFrameDims(onChange, {
    getRoot: currentFrameRoot,
    subscribeRoots: subscribeFrameRoots,
    win: window,
    createObserver: (callback) => new MutationObserver(callback),
  });

/**
 * body 直下へ portal する部品が、枠の寸法変数(--app-header-height / --app-banner-height / --app-bottom-nav-height)を
 * 外枠と同じ値で使うための style。portal した部品の一番外の要素に付け、中では外枠の中と同じく var() で書く。
 *
 * - 値 = 外枠(枠が useFrameRootRef で登録した要素、最後に登録した物)の計算値。部位を隠している間は 0 になった値
 * - 隠す・出すの切り替え、画面幅の変化、枠の出入りに表示中も追随する。登録が無い時(枠の外)は空 = :root の既定(0px)
 * - safe-area(--app-safe-area-*)は :root にあるので写さない。--app-bottom-nav-height は safe-area を含むので足さない
 * - SSR / hydration 中は空(hydration 不一致を起こさない)
 *
 * ```tsx
 * const frameDims = useFrameDimsStyle();
 * return createPortal(
 *   <div style={frameDims} className="fixed inset-x-0 bottom-[var(--app-bottom-nav-height,0px)]">…</div>,
 *   document.body,
 * );
 * ```
 */
export function useFrameDimsStyle(): FrameDimsStyle {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
