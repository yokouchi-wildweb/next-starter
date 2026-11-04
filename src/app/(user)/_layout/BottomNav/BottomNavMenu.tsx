"use client";

/**
 * ボトムナビのメニュー項目(type: "menu")から開くアクションメニュー(既定は上向き)。各アクションは遷移のみ(href)
 */

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { ActionPopover } from "@/components/Overlays/Popover";

import type { BottomNavMenuItem } from "./types";

type BottomNavMenuProps = {
  readonly item: BottomNavMenuItem;
  /** メニューを開くトリガー要素(フォーカスできる要素) */
  readonly trigger: ReactNode;
  /** 開く向き。既定 "top"(画面下のボトムナビ用)。画面上の帯などから開くときは "bottom" */
  readonly side?: "top" | "bottom";
};

export const BottomNavMenu = ({ item, trigger, side = "top" }: BottomNavMenuProps) => {
  const router = useRouter();

  return (
    <ActionPopover
      trigger={trigger}
      title={item.menuTitle ?? item.label}
      side={side}
      align="center"
      actions={item.menu.map((action) => ({
        label: action.label,
        icon: action.icon,
        onClick: () => router.push(action.href),
      }))}
    />
  );
};
