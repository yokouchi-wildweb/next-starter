"use client";

import { cn } from "@/lib/cn";

import { useBottomNavVisibility } from "../../contexts/BottomNavVisibilityContext";

import { BottomNavItem } from "./BottomNavItem";
import { useBottomNavItems } from "./useBottomNavItems";

export const UserBottomNav = () => {
  const { visibility } = useBottomNavVisibility();
  const { items, height, enabled } = useBottomNavItems();

  // 機能が無効の場合は何も表示しない
  if (!enabled) {
    return null;
  }

  // 表示/非表示のクラスを決定
  const visibilityClass = (() => {
    if (!visibility.sp && !visibility.pc) return "hidden";
    if (!visibility.sp && visibility.pc) return "hidden sm:flex";
    if (visibility.sp && !visibility.pc) return "flex sm:hidden";
    return "flex";
  })();

  return (
    <nav
      id="bottom-nav"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 items-center justify-around border-t border-border bg-background shadow-[0_-2px_10px_rgba(0,0,0,0.05)]",
        visibilityClass,
      )}
      style={{ height, paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((item) => (
        <BottomNavItem key={item.key} item={item} />
      ))}
    </nav>
  );
};
