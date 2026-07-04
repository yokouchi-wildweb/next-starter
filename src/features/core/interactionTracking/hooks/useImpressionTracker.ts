// src/features/core/interactionTracking/hooks/useImpressionTracker.ts
// 要素がビューポートに入ったらインプレッションを 1 回記録するフック

"use client";

import { useCallback, useEffect, useRef } from "react";

import { trackImpression } from "@/features/core/interactionTracking/services/client/impressionTracker";

export type UseImpressionTrackerOptions = {
  targetType: string;
  targetId: string;
  /** 既定 "impression" */
  action?: string;
  source?: string;
  /** 表示とみなす交差率。既定 0.5（要素の半分が見えたら計上） */
  threshold?: number;
  /** false で計測を無効化（プレビュー画面等） */
  enabled?: boolean;
};

/**
 * 返り値の ref を計測対象の要素に付けると、要素が threshold 以上
 * ビューポートに入った時点でインプレッションを 1 回記録する。
 *
 * - 同一マウント・同一対象につき 1 回だけ発火（スクロールで再交差しても重複しない）。
 *   targetId 等が変わった場合はリセットされ、新しい対象として再度計測される
 * - 送信は impressionTracker のバッファ経由（15 秒ごと / 離脱時にまとめて送信）
 *
 * 使用例:
 * ```tsx
 * const impressionRef = useImpressionTracker({ targetType: "bulletin", targetId: b.id, source: "home" });
 * return <Block ref={impressionRef}>...</Block>;
 * ```
 */
export function useImpressionTracker(options: UseImpressionTrackerOptions) {
  const { targetType, targetId, action, source, threshold = 0.5, enabled = true } = options;

  const firedRef = useRef(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 対象が変わったら「発火済み」をリセットして新しい対象として計測し直す
  useEffect(() => {
    firedRef.current = false;
  }, [targetType, targetId, action, source]);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node || !enabled || firedRef.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0]?.isIntersecting || firedRef.current) return;
          firedRef.current = true;
          trackImpression({ targetType, targetId, action, source });
          observer.disconnect();
        },
        { threshold },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [targetType, targetId, action, source, threshold, enabled],
  );
}
