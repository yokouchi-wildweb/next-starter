"use client";

import { cn } from "@/lib/cn";

import { BottomNavItem } from "./BottomNavItem";
import { useBottomNavItems } from "./useBottomNavItems";

export const UserBottomNav = () => {
  const { items, height } = useBottomNavItems();

  // 隠す端末・ページ(各ルートの frame.ts)では styles/_base/frame.css が display: none にする
  return (
    <nav
      id="bottom-nav"
      aria-label="メインメニュー"
      data-frame-part="bottom-nav"
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 items-center justify-around border-t border-border bg-background shadow-[0_-2px_10px_rgba(0,0,0,0.05)]",
        "[&>*:not(:last-child)]:border-r-2 [&>*:not(:last-child)]:border-border/30",
        "flex",
      )}
      // 高さ = config の px + 下の safe-area。padding の safe-area ぶんだけ伸ばし、項目の領域は config の px のまま
      // (外枠の --app-bottom-nav-height と同じ計算)
      style={{ height: `calc(${height}px + var(--app-safe-area-bottom))`, paddingBottom: "var(--app-safe-area-bottom)" }}
    >
      {items.map((item) => (
        <BottomNavItem key={item.key} item={item} />
      ))}
    </nav>
  );
};
