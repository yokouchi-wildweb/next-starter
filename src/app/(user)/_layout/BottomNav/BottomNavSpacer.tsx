"use client";

/**
 * BottomNavの高さ分のスペースを確保するスペーサーコンポーネント
 * 高さは外枠の --app-bottom-nav-height(UserLayout が config の値 + 下の safe-area を書き、
 * 隠す端末・ページ(各ルートの枠の宣言 frame.default.ts / frame.ts)では styles/_base/frame.css が 0 にする)
 */
export const BottomNavSpacer = () => {
  return (
    <div
      id="bottom-nav-spacer"
      data-frame-part="bottom-nav"
      className="shrink-0 h-[var(--app-bottom-nav-height,0px)]"
      aria-hidden="true"
    />
  );
};
