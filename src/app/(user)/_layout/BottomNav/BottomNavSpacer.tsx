"use client";

import { useBottomNavItems } from "./useBottomNavItems";

/**
 * BottomNavの高さ分のスペースを確保するスペーサーコンポーネント
 * 高さは外枠の --app-bottom-nav-height(UserLayout が config の値を書き、出さないデバイスと Hide* で隠す間は印の CSS が 0 にする)
 */
export const BottomNavSpacer = () => {
  const { enabled } = useBottomNavItems();

  // 機能が無効の場合は何も表示しない
  if (!enabled) {
    return null;
  }

  return (
    <div
      id="bottom-nav-spacer"
      data-frame-part="bottom-nav"
      className="shrink-0 h-[var(--app-bottom-nav-height,0px)]"
      aria-hidden="true"
    />
  );
};
