// src/hooks/useInView.ts

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseInViewOptions = {
  /** IntersectionObserver の threshold (0〜1)。デフォルト: 0。 */
  threshold?: number | number[];
  /** スクロール祖先要素。デフォルト: ビューポート。 */
  root?: Element | Document | null;
  /** root の周囲のマージン。CSS margin 形式（例: "100px 0px"）。 */
  rootMargin?: string;
  /** true の場合、最初の交差で監視を停止し isInView を true に固定する。 */
  once?: boolean;
  /** false の場合、監視を無効化する。デフォルト: true。 */
  enabled?: boolean;
};

type UseInViewResult = {
  /** 監視対象の要素に設定する ref コールバック。 */
  ref: (node: Element | null) => void;
  /** 要素がビューポート（または root）内に表示されているかどうか。 */
  isInView: boolean;
  /** 最新の IntersectionObserverEntry。初回コールバック前は null。 */
  entry: IntersectionObserverEntry | null;
};

/**
 * 要素がビューポート内に表示されているかを監視するフック。
 *
 * ```tsx
 * const { ref, isInView } = useInView();
 * return <section ref={ref}>{isInView && <Content />}</section>;
 *
 * // 一度だけトリガー（アニメーション、遅延読み込み）
 * const { ref, isInView } = useInView({ once: true });
 *
 * // 50% 以上見えたら交差とみなす
 * const { ref, isInView } = useInView({ threshold: 0.5 });
 *
 * // 要素が近づいたら先読み（200px 手前で検知）
 * const { ref, isInView } = useInView({ rootMargin: "200px" });
 *
 * // intersectionRatio を使った高度な制御
 * const { ref, entry } = useInView({ threshold: [0, 0.25, 0.5, 0.75, 1] });
 * const opacity = entry?.intersectionRatio ?? 0;
 * ```
 */
export function useInView(options: UseInViewOptions = {}): UseInViewResult {
  const { threshold, root, rootMargin, once = false, enabled = true } = options;

  const [node, setNode] = useState<Element | null>(null);
  const [isInView, setIsInView] = useState(false);
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);
  const frozenRef = useRef(false);

  const ref = useCallback((el: Element | null) => setNode(el), []);

  useEffect(() => {
    if (!node || !enabled || frozenRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (!latest) return;

        setEntry(latest);
        setIsInView(latest.isIntersecting);

        if (once && latest.isIntersecting) {
          frozenRef.current = true;
          observer.disconnect();
        }
      },
      { threshold, root, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, enabled, threshold, root, rootMargin, once]);

  return { ref, isInView, entry };
}
