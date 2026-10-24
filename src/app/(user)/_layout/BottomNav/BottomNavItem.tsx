"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/Form/Button/Button";
import { ACTIVE_COLOR_TYPE } from "@/config/ui/user-bottom-menu.config";
import { cn } from "@/lib/cn";

import { BottomNavMenu } from "./BottomNavMenu";
import {
  isBottomNavMenuItem,
  type BottomNavItem as BottomNavItemType,
  type BottomNavLinkItem,
  type BottomNavMenuItem,
} from "./types";

type BottomNavItemProps = {
  readonly item: BottomNavItemType;
};

const ITEM_CLASS_NAME = "flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors";

/** カレントアイテムの色クラスマッピング */
const ACTIVE_COLOR_CLASS_MAP = {
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
} as const;

/**
 * カレントページかどうかを判定
 */
const useIsActive = (item: BottomNavLinkItem): boolean => {
  const pathname = usePathname();

  // matchPathsが指定されている場合は前方一致で判定
  if (item.matchPaths && item.matchPaths.length > 0) {
    return item.matchPaths.some((path) => pathname.startsWith(path));
  }

  // matchPathsが未指定の場合はhrefと完全一致で判定
  return pathname === item.href;
};

/** アイコン・バッジ・ラベル(リンク項目とメニュー項目で共通) */
const ItemContent = ({ item }: BottomNavItemProps) => {
  const Icon = item.icon;

  return (
    <>
      <div className="relative">
        <Icon className="size-6" />
        {item.badge && (
          <span className="absolute -top-1 -right-1">
            {item.badge}
          </span>
        )}
      </div>
      <span id={`bottom-nav-label-${item.key}`} className="text-[10px] font-medium leading-tight">{item.label}</span>
    </>
  );
};

const BottomNavLinkEntry = ({ item }: { readonly item: BottomNavLinkItem }) => {
  const isActive = useIsActive(item);
  const activeColorClass = ACTIVE_COLOR_CLASS_MAP[ACTIVE_COLOR_TYPE];

  return (
    <Link
      id={`bottom-nav-item-${item.key}`}
      href={item.href}
      className={cn(ITEM_CLASS_NAME, isActive ? activeColorClass : "text-muted-foreground")}
    >
      <ItemContent item={item} />
    </Link>
  );
};

/** メニュー項目: タップで上向きのアクションメニューを開く。カレントにはならない */
const BottomNavMenuEntry = ({ item }: { readonly item: BottomNavMenuItem }) => (
  <BottomNavMenu
    item={item}
    trigger={
      <Button
        id={`bottom-nav-item-${item.key}`}
        type="button"
        variant="none"
        size="none"
        aria-label={item.menuTitle ?? item.label}
        className={cn(ITEM_CLASS_NAME, "h-full rounded-none text-muted-foreground")}
      >
        <ItemContent item={item} />
      </Button>
    }
  />
);

export const BottomNavItem = ({ item }: BottomNavItemProps) =>
  isBottomNavMenuItem(item) ? <BottomNavMenuEntry item={item} /> : <BottomNavLinkEntry item={item} />;
