"use client";

import { cn } from "@/lib/cn";

import { BottomNavItem } from "./BottomNavItem";
import { useBottomNavItems } from "./useBottomNavItems";

export const UserBottomNav = () => {
  const { items, height, enabled } = useBottomNavItems();

  // 機能が無効の場合は何も表示しない
  if (!enabled) {
    return null;
  }

  // 出さないデバイス(config の BOTTOM_NAV_VISIBILITY)と Hide* で隠す時は、印の CSS が display: none にする
  return (
    <nav
      id="bottom-nav"
      data-frame-part="bottom-nav"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 items-center justify-around border-t border-border bg-background shadow-[0_-2px_10px_rgba(0,0,0,0.05)]",
        "[&>*:not(:last-child)]:border-r-2 [&>*:not(:last-child)]:border-border/30",
        "flex",
      )}
      style={{ height, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => (
        <BottomNavItem key={item.key} item={item} />
      ))}
    </nav>
  );
};
