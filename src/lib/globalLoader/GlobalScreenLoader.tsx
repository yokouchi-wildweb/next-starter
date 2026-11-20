// src/lib/globalLoader/GlobalScreenLoader.tsx

"use client";

import { createPortal } from "react-dom";

import { ScreenLoader } from "@/components/Overlays/Loading";
import { useIsClient } from "@/lib/isClient";

import { useGlobalLoaderStore } from "./stores";

/**
 * グローバルローダーを Portal で body 直下に描画するコンポーネント。
 * ルートレイアウトに 1 つだけ配置して使用する。動かすのは useGlobalLoader の showLoader / hideLoader。
 *
 * 描画は棚の ScreenLoader(mode="fullscreen")をそのまま使う(package.json の peers で components を読む、当議会 D208)。
 * 出力が ScreenLoader と同じことは src/components/Overlays/Loading/globalLoaderParity.test.tsx が確かめる。
 *
 * @example
 * // layout.tsx
 * <GlobalScreenLoader />
 *
 * // 使う側
 * const { showLoader, hideLoader } = useGlobalLoader();
 * showLoader("ガチャ準備中…");
 * await draw();
 * hideLoader();
 */
export function GlobalScreenLoader() {
  const { isVisible, options } = useGlobalLoaderStore();
  const mounted = useIsClient();

  if (!mounted || !isVisible) {
    return null;
  }

  const { className, spinnerClassName, spinnerVariant, message, messageClassName } = options;

  const content = (
    <ScreenLoader
      mode="fullscreen"
      className={className}
      spinnerClassName={spinnerClassName}
      spinnerVariant={spinnerVariant}
      message={message}
      messageClassName={messageClassName}
    />
  );

  return createPortal(content, document.body);
}
