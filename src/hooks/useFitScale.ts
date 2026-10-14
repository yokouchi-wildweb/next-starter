// src/hooks/useFitScale.ts

"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";

/**
 * フィット方式。
 * - contain: 幅・高さ両方が収まる倍率（レターボックス、キオスク画面の主用途）
 * - width: コンテナ幅だけに合わせる（高さは倍率に従って伸びる。ページ内キャンバス等）
 * - height: コンテナ高さだけに合わせる
 */
export type FitScaleMode = "contain" | "width" | "height";

export type UseFitScaleOptions = {
  /** 論理キャンバスの幅 (px) */
  logicalWidth: number;
  /** 論理キャンバスの高さ (px) */
  logicalHeight: number;
  /** 既定: contain */
  fit?: FitScaleMode;
  /** これ以下には縮めない（既定 0 = 制限なし。下回った分はコンテナ側の overflow で処理） */
  minScale?: number;
  /** これ以上には拡大しない（既定 Infinity = 制限なし） */
  maxScale?: number;
};

export type FitScaleState = {
  /** 論理キャンバスに掛ける表示倍率（計測前は 1） */
  scale: number;
  /** 表示上の幅 (px) = logicalWidth × scale */
  width: number;
  /** 表示上の高さ (px) = logicalHeight × scale */
  height: number;
  /** コンテナの実寸 (contentRect、計測前は 0) */
  containerWidth: number;
  containerHeight: number;
  /** ResizeObserver による初回計測が済み、倍率が確定しているか */
  isMeasured: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * 固定の論理 W×H を持つ描画領域を、コンテナに収まる表示倍率へ変換するフック。
 * 論理座標系は不変のまま倍率だけを返すので、座標データ（位置・サイズ）は
 * 画面サイズに影響されない。transform:scale でも Canvas/Konva の stage scale でも使える。
 *
 * - ResizeObserver は useEffect 内でのみ生成（SSR 安全、render 中に window を触らない）
 * - 計測前（SSR / 初回描画）は scale 1・isMeasured false。描画の跳びを隠したい場合は
 *   isMeasured を見て visibility を切り替える（<ScaledStage> は内蔵）
 * - フィットに必要な寸法が 0 の間（display:none 等）は isMeasured false のまま
 * - 既定は純粋フィット（min 0 / max Infinity）。「スマホ幅で文字が潰れるので下限 0.6」
 *   のような判断はドメイン側の都合なので、呼び出し側が minScale / maxScale で渡す
 *
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { scale, width, height } = useFitScale(containerRef, {
 *   logicalWidth: 1280,
 *   logicalHeight: 800,
 * });
 * ```
 */
export function useFitScale(
  containerRef: RefObject<HTMLElement | null>,
  {
    logicalWidth,
    logicalHeight,
    fit = "contain",
    minScale = 0,
    maxScale = Number.POSITIVE_INFINITY,
  }: UseFitScaleOptions,
): FitScaleState {
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize((prev) =>
        prev && prev.width === width && prev.height === height ? prev : { width, height },
      );
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, [containerRef]);

  return useMemo(() => {
    const containerWidth = containerSize?.width ?? 0;
    const containerHeight = containerSize?.height ?? 0;

    const needsWidth = fit !== "height";
    const needsHeight = fit !== "width";
    const isMeasured =
      containerSize !== null &&
      (!needsWidth || containerWidth > 0) &&
      (!needsHeight || containerHeight > 0) &&
      logicalWidth > 0 &&
      logicalHeight > 0;

    let scale = 1;
    if (isMeasured) {
      const byWidth = containerWidth / logicalWidth;
      const byHeight = containerHeight / logicalHeight;
      const raw =
        fit === "width" ? byWidth : fit === "height" ? byHeight : Math.min(byWidth, byHeight);
      scale = clamp(raw, minScale, maxScale);
    }

    return {
      scale,
      width: logicalWidth * scale,
      height: logicalHeight * scale,
      containerWidth,
      containerHeight,
      isMeasured,
    };
  }, [containerSize, fit, logicalWidth, logicalHeight, minScale, maxScale]);
}
