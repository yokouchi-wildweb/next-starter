"use client";

/**
 * ボトムナビのメニュー項目(type: "menu")から上向きに開くアクションメニュー。各アクションは遷移のみ(href)
 */

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { ActionPopover } from "@/components/Overlays/Popover";

import type { BottomNavMenuItem } from "./types";

type BottomNavMenuProps = {
  readonly item: BottomNavMenuItem;
  /** メニューを開くトリガー要素(フォーカスできる要素) */
  readonly trigger: ReactNode;
};

export const BottomNavMenu = ({ item, trigger }: BottomNavMenuProps) => {
  const router = useRouter();

  return (
    <ActionPopover
      trigger={trigger}
      title={item.menuTitle ?? item.label}
      side="top"
      align="center"
      actions={item.menu.map((action) => ({
        label: action.label,
        icon: action.icon,
        onClick: () => router.push(action.href),
      }))}
    />
  );
};
