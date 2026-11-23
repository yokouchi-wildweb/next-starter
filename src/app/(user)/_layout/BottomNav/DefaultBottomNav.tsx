"use client";

import { BottomNavSpacer } from "./BottomNavSpacer";
import { UserBottomNav } from "./index";
import { useBottomNavItems } from "./useBottomNavItems";

/**
 * 既定のボトムナビ(UserLayout の bottomNav slot を省略した時): 高さ分のスペーサー + UserBottomNav。
 * 項目はセッションで変わるので、この部品は枠の部位の包み(FramePart)の Suspense の内側で読む。項目が空ならスペーサーごと描かず、
 * 外枠の --app-bottom-nav-height も 0 のまま(描いた時だけ styles/core/frame.css が外枠の :has() で値を入れる)
 */
export const DefaultBottomNav = () => {
  const { items } = useBottomNavItems();
  if (items.length === 0) return null;
  return (
    <>
      <BottomNavSpacer />
      <UserBottomNav />
    </>
  );
};
