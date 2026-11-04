// src/hooks/useFrameDimsStyle.ts

"use client";

import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";

/**
 * 枠の寸法変数(部位の名前 → 変数名)。部位の名前は枠の部位一覧(data-slot: header / banner / bottom-nav)に合わせる。
 * 値の意味と書く所: src/app/(user)/_layout/README.md「寸法の CSS 変数」
 */
export const FRAME_DIM_VARS = {
  header: "--app-header-height",
  banner: "--app-banner-height",
  "bottom-nav": "--app-bottom-nav-height",
} as const;

export type FrameDimPart = keyof typeof FRAME_DIM_VARS;
type FrameDimVar = (typeof FRAME_DIM_VARS)[FrameDimPart];

/** 枠の寸法変数を写した style(外枠に書かれている変数だけを持つ) */
export type FrameDimsStyle = CSSProperties & { [K in FrameDimVar]?: string };

/** 外枠の印(UserLayout・AdminLayout の外枠の公開の属性) */
const FRAME_ROOT_SELECTOR = "[data-frame-root]";

const EMPTY_STYLE: FrameDimsStyle = Object.freeze({});

type FrameRootLookup = { querySelector(selector: string): Element | null };
type ReadStyle = (element: Element) => { getPropertyValue(name: string): string };

/**
 * 外枠の寸法変数の計算値を style に写す(純関数。hook の中身と test 用)。外枠が無い時(枠の外のページ)は空。
 * 隠している部位の変数は、隠す側の CSS が 0 にした計算値をそのまま写す(何が 0 にしたかは見ない)。
 */
export function readFrameDimsStyle(root: FrameRootLookup, readStyle: ReadStyle): FrameDimsStyle {
  const frameRoot = root.querySelector(FRAME_ROOT_SELECTOR);
  if (!frameRoot) return EMPTY_STYLE;
  const computed = readStyle(frameRoot);
  const style: FrameDimsStyle = {};
  for (const name of Object.values(FRAME_DIM_VARS)) {
    const value = computed.getPropertyValue(name).trim();
    if (value) style[name] = value;
  }
  return style;
}

let cache: { key: string; style: FrameDimsStyle } = { key: "", style: EMPTY_STYLE };

function getSnapshot(): FrameDimsStyle {
  const style = readFrameDimsStyle(document, (element) => getComputedStyle(element));
  const key = JSON.stringify(style);
  if (key !== cache.key) cache = { key, style };
  return cache.style;
}

const getServerSnapshot = () => EMPTY_STYLE;

/**
 * 外枠の中の変化(印の出入り・部品の差し替え)・外枠の属性(inline の寸法・隠す宣言)・画面幅(デバイスの境目)を見て、
 * 1 フレームに 1 回だけ読み直す。外枠は購読を始めた時のものを見る(枠は遷移しても描き直されない)。
 */
function subscribe(onChange: () => void): () => void {
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      onChange();
    });
  };
  const frameRoot = document.querySelector(FRAME_ROOT_SELECTOR);
  const observer = frameRoot ? new MutationObserver(schedule) : null;
  if (frameRoot && observer) {
    observer.observe(frameRoot, { attributes: true });
    observer.observe(frameRoot, { childList: true, subtree: true });
  }
  window.addEventListener("resize", schedule);
  return () => {
    observer?.disconnect();
    window.removeEventListener("resize", schedule);
    if (frame) cancelAnimationFrame(frame);
  };
}

/**
 * body 直下へ portal する部品が、枠の寸法変数(--app-header-height / --app-banner-height / --app-bottom-nav-height)を
 * 外枠と同じ値で使うための style。portal した部品の一番外の要素に付け、中では外枠の中と同じく var() で書く。
 *
 * - 値 = 外枠 [data-frame-root] の計算値。部位を隠している間(ページの印・出さないデバイス)は 0 になった値
 * - 隠す・出すの切り替え、画面幅の変化に表示中も追随する。外枠が無い時(admin の一部・枠の外)は空 = :root の既定(0px)
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
