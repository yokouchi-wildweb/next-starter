/**
 * ヘッダーのレイアウトシェル
 *
 * left/center/right の slot で構成要素を差し替え可能
 * 「検索」「通知」「CTAボタン」などの追加が容易
 */

import type { ReactNode } from "react";

import { Flex } from "@/components/Layout/Flex";

export type HeaderShellProps = {
  /** 左側スロット（通常: Brand） */
  readonly left?: ReactNode;
  /** 中央スロット（通常: PCナビゲーション） */
  readonly center?: ReactNode;
  /** 右側スロット（通常: SPメニュートグル、CTA、通知など） */
  readonly right?: ReactNode;
};

export const HeaderShell = ({ left, center, right }: HeaderShellProps) => (
  <Flex data-slot="header-shell" justify="between" className="mx-auto w-full max-w-6xl px-4 py-2 sm:py-4">
    {/* 左側: Brand など */}
    {left && <Flex data-slot="header-left" align="center">{left}</Flex>}

    {/* 中央: PCナビゲーションなど */}
    {center && <Flex data-slot="header-center">{center}</Flex>}

    {/* 右側: SPメニュートグル、CTA、通知など */}
    {right && <Flex data-slot="header-right" align="center" className="gap-2">{right}</Flex>}
  </Flex>
);
