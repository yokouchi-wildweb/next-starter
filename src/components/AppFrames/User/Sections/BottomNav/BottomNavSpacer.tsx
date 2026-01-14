"use client";

import { useBottomNavVisibility } from "../../contexts/BottomNavVisibilityContext";

import { useBottomNavItems } from "./useBottomNavItems";

/**
 * BottomNavの高さ分のスペースを確保するスペーサーコンポーネント
 * BottomNavが表示されている時だけ高さを持つ
 */
export const BottomNavSpacer = () => {
  const { visibility } = useBottomNavVisibility();
  const { height, enabled } = useBottomNavItems();

  // 機能が無効の場合は何も表示しない
  if (!enabled) {
    return null;
  }

  // SP/PCそれぞれの表示状態に応じたスタイルを決定
  const spHeight = visibility.sp ? height : 0;
  const pcHeight = visibility.pc ? height : 0;

  // 両方0なら何も表示しない
  if (spHeight === 0 && pcHeight === 0) {
    return null;
  }

  return (
    <>
      {/* スマホ用スペーサー */}
      {spHeight > 0 && (
        <div
          id="bottom-nav-spacer-sp"
          className="block sm:hidden"
          style={{ height: spHeight }}
          aria-hidden="true"
        />
      )}
      {/* PC用スペーサー */}
      {pcHeight > 0 && (
        <div
          id="bottom-nav-spacer-pc"
          className="hidden sm:block"
          style={{ height: pcHeight }}
          aria-hidden="true"
        />
      )}
    </>
  );
};
