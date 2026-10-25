"use client";

import { type ReactNode, useEffect } from "react";

import { useElementSize } from "@/hooks/useElementSize";

/** banner slot の帯の要素 id */
export const APP_BANNER_ELEMENT_ID = "app-banner" as const;

type BannerProps = {
  readonly children: ReactNode;
  /** 帯の実測の高さ(px)が変わるたびに呼ぶ。UserLayout が --app-banner-height に書く */
  readonly onHeightChange: (height: number) => void;
};

/**
 * ヘッダーより上に固定で出す帯(UserLayout の banner slot の殻)。
 * 自分の高さを測って親に返す。banner がない時は描かれないので、測定も走らない
 * (useHeaderHeight は要素が見つかるまで requestAnimationFrame で回り続けるため流用しない)。
 */
export function Banner({ children, onHeightChange }: BannerProps) {
  const { ref, height } = useElementSize<HTMLDivElement>();

  useEffect(() => {
    onHeightChange(height);
  }, [height, onHeightChange]);

  return (
    <div id={APP_BANNER_ELEMENT_ID} ref={ref} className="fixed inset-x-0 top-0 header-layer">
      {children}
    </div>
  );
}
