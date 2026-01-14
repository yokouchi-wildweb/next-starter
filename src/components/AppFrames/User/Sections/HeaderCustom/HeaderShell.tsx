/**
 * ヘッダーのレイアウトシェル
 *
 * left/center/right の slot で構成要素を差し替え可能
 * 「検索」「通知」「CTAボタン」などの追加が容易
 */

import type { ReactNode } from "react";

export type HeaderShellProps = {
  /** 左側スロット（通常: Brand） */
  readonly left?: ReactNode;
  /** 中央スロット（通常: PCナビゲーション） */
  readonly center?: ReactNode;
  /** 右側スロット（通常: SPメニュートグル、CTA、通知など） */
  readonly right?: ReactNode;
};

export const HeaderShell = ({ left, center, right }: HeaderShellProps) => (
  <div id="header-custom-shell" className="mx-auto flex w-full max-w-6xl items-stretch justify-between px-4 py-2 sm:py-4">
    {/* 左側: Brand など */}
    {left && <div id="header-custom-left" className="flex items-center">{left}</div>}

    {/* 中央: PCナビゲーションなど */}
    {center && <div id="header-custom-center" className="flex items-stretch">{center}</div>}

    {/* 右側: SPメニュートグル、CTA、通知など */}
    {right && <div id="header-custom-right" className="flex items-center gap-2">{right}</div>}
  </div>
);
