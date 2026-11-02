"use client";

// src/components/Form/Input/Manual/AsyncOptionSource/usePickerPopoverSide.ts
//
// ピッカーを開く瞬間にアンカー（トリガーを包む要素）の位置を測り、PopoverContent の side を決める。
// 使い方: anchorRef をトリガーを包む要素に付け、onOpenChange(true) で measure() を呼び、
// <PopoverContent side={side} {...popoverContentProps}> の順で渡す（呼び出し側の side が勝つ）。
// 制約: defaultOpen / 外部からのプログラム的な open では measure されず "bottom"（flip が保険）。

import { useCallback, useRef, useState } from "react";

import { decidePopoverSide, type PopoverVerticalSide } from "./popoverSide";

export function usePickerPopoverSide(preferredHeight: number) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<PopoverVerticalSide>("bottom");

  const measure = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") return;
    const rect = anchor.getBoundingClientRect();
    setSide(
      decidePopoverSide({
        anchorTop: rect.top,
        anchorBottom: rect.bottom,
        viewportHeight: window.innerHeight,
        preferredHeight,
      }),
    );
  }, [preferredHeight]);

  return { side, anchorRef, measure };
}
