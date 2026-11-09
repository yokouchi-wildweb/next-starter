"use client";

/**
 * BottomNavの高さ分のスペースを確保するスペーサーコンポーネント
 * 高さは外枠の --app-bottom-nav-height(UserLayout が config の値 + 下の safe-area を書き、
 * 隠す端末・ページ(各ルートの枠の宣言 frame.ts / frame.override.ts)では styles/core/frame.css が 0 にする)
 */
export const BottomNavSpacer = () => {
  return (
    <div
      id="bottom-nav-spacer"
      data-slot="bottom-nav"
      className="shrink-0 h-[var(--app-bottom-nav-height,0px)]"
      aria-hidden="true"
    />
  );
};
