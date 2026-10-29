// src/hooks/useViewportOrientation.ts

"use client";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useViewportSizeStore } from "@/stores/viewportSize";

/**
 * 「高さが足りない」と判定する max-height 閾値 (px)。
 * 横向きスマホ (幅は十分だが高さ 350〜430px 程度) を拾うための既定値。
 *
 * ⚠️ CSS 側の `short:` バリアント (src/styles/_base/theme.css の @custom-variant) と
 * 手動で同期すること。Tailwind のメディアクエリは CSS 変数を参照できないため
 * 片側だけ変えると JS と CSS の判定がずれる。
 */
export const SHORT_HEIGHT_MAX_PX = 500;

export type ViewportOrientation = "landscape" | "portrait";

export type UseViewportOrientationOptions = {
  /** isShortHeight の max-height 閾値 (px)。既定: SHORT_HEIGHT_MAX_PX */
  shortHeightMax?: number;
};

export type ViewportOrientationState = {
  orientation: ViewportOrientation;
  /** 高さが shortHeightMax 以下 (= 圧縮レイアウトに切り替えるべき状態) */
  isShortHeight: boolean;
  /** 実寸 (visualViewport 由来、viewportSize ストア。計測前は 0) */
  width: number;
  height: number;
  /** 幅と高さの短い方 (計測前は 0) */
  shortSide: number;
};

/**
 * ビューポートの向きと「高さ基準」ブレークポイントを返すフック。
 * Tier1 の幅ベース breakpoint (sm/md/...) では拾えない横向きスマホ向け。
 *
 * - `orientation` / `isShortHeight` は matchMedia 由来 (レイアウトビューポート基準)。
 *   CSS の `landscape:` / `short:` バリアントと必ず同じ判定になり、
 *   ソフトキーボード表示で visualViewport が縮んでも反転しない
 * - `width` / `height` / `shortSide` は実寸が必要な計算用。viewportSize ストア
 *   (ViewportHeightWatcher が root layout で更新) から読むため FullScreen /
 *   --viewport-height と同じ値になる
 * - SSR / hydration 中は portrait + isShortHeight=false + 実寸 0 で固定
 *
 * ```tsx
 * const { isShortHeight, orientation } = useViewportOrientation();
 * return <Stack space={isShortHeight ? 1 : 4}>...</Stack>;
 * ```
 */
export function useViewportOrientation(
  options?: UseViewportOrientationOptions,
): ViewportOrientationState {
  const shortHeightMax = options?.shortHeightMax ?? SHORT_HEIGHT_MAX_PX;

  const isLandscape = useMediaQuery("(orientation: landscape)");
  const isShortHeight = useMediaQuery(`(max-height: ${shortHeightMax}px)`);
  const { width, height } = useViewportSizeStore();

  return {
    orientation: isLandscape ? "landscape" : "portrait",
    isShortHeight,
    width,
    height,
    shortSide: Math.min(width, height),
  };
}
