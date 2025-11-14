// src/hooks/useElementSize.ts

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 要素の幅と高さを取得するための汎用フック
 *
 * ```tsx
 * const { ref, width, height } = useElementSize<HTMLDivElement>();
 * return <div ref={ref}>...</div>;
 * ```
 */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const updateSize = useCallback(() => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(ref.current);

    return () => observer.disconnect();
  }, [updateSize]);

  return { ref, width: size.width, height: size.height };
}

