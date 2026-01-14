"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ACTIVE_COLOR_TYPE } from "@/config/ui/user-bottom-menu.config";
import { cn } from "@/lib/cn";

import type { BottomNavItem as BottomNavItemType } from "./types";

type BottomNavItemProps = {
  readonly item: BottomNavItemType;
};

/** カレントアイテムの色クラスマッピング */
const ACTIVE_COLOR_CLASS_MAP = {
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
} as const;

/**
 * カレントページかどうかを判定
 */
const useIsActive = (item: BottomNavItemType): boolean => {
  const pathname = usePathname();

  // matchPathsが指定されている場合は前方一致で判定
  if (item.matchPaths && item.matchPaths.length > 0) {
    return item.matchPaths.some((path) => pathname.startsWith(path));
  }

  // matchPathsが未指定の場合はhrefと完全一致で判定
  return pathname === item.href;
};

export const BottomNavItem = ({ item }: BottomNavItemProps) => {
  const isActive = useIsActive(item);
  const Icon = item.icon;
  const activeColorClass = ACTIVE_COLOR_CLASS_MAP[ACTIVE_COLOR_TYPE];

  return (
    <Link
      id={`bottom-nav-item-${item.key}`}
      href={item.href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors",
        isActive ? activeColorClass : "text-muted-foreground",
      )}
    >
      <Icon id={`bottom-nav-icon-${item.key}`} className="size-6" />
      <span id={`bottom-nav-label-${item.key}`} className="text-[10px] font-medium leading-tight">{item.label}</span>
    </Link>
  );
};
