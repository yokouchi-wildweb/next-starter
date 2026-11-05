// src/features/core/interactionTracking/hooks/useImpressionTracker.ts
// 要素がビューポートに入ったらインプレッションを 1 回記録するフック

"use client";

import { useEffect, useRef, useState } from "react";

import { trackImpression } from "@/features/core/interactionTracking/services/client/impressionTracker";
import { useInView } from "@/hooks/useInView";

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
 * - 監視は useInView に任せる。記録した後は enabled を落として監視を外し、対象が変わったら付け直す
 *   （useInView の once は一度止まると戻らないため、対象ごとの記録済みの印で止める）
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

  // 記録済みの対象の鍵。今の対象と同じなら記録済み（対象が変わると自然に未記録へ戻る）
  const targetKey = JSON.stringify([targetType, targetId, action ?? null, source ?? null]);
  const [trackedKey, setTrackedKey] = useState<string | null>(null);
  const tracked = trackedKey === targetKey;

  // 送信済みの印（StrictMode で effect が 2 回走っても二重に記録しない）
  const sentKeyRef = useRef<string | null>(null);
  // 記録に使った交差の結果。監視を外した後も useInView の entry は最後の値のまま残るので、
  // 対象が変わったら付け直した observer の新しい entry が届くまで数えない（画面外の要素を記録しない）
  const usedEntryRef = useRef<IntersectionObserverEntry | null>(null);

  const { ref, entry } = useInView({ threshold, enabled: enabled && !tracked });

  useEffect(() => {
    if (!enabled || !entry?.isIntersecting || entry === usedEntryRef.current) return;
    if (sentKeyRef.current === targetKey) return;
    sentKeyRef.current = targetKey;
    usedEntryRef.current = entry;
    trackImpression({ targetType, targetId, action, source });
    // 記録した対象の監視を外すための、対象ごとに 1 回だけの更新（交差の結果に応じて止める）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTrackedKey(targetKey);
  }, [enabled, entry, targetKey, targetType, targetId, action, source]);

  return ref;
}
