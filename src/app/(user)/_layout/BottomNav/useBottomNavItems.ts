/**
 * ボトムナビゲーションの状態を提供するhook
 *
 * 項目は枠の描画用の設定 ../config.ui.ts の bottomMenu、高さは ../config.ts の bottomMenu.height
 * バッジは項目の badge で渡す
 * 差した項目: 点 userMenuItems(menu "bottomNav")を設定の項目に重ねる
 */

"use client";

import { useMemo } from "react";

import { useFrameSession } from "@/app/_layout/useFrameSession";

import { userLayoutConfig } from "../config";
import { userLayoutUiConfig } from "../config.ui";
import { mergeMenuItems } from "../hooks/mergeMenuItems";
import { usePluggedMenuItems } from "../hooks/usePluggedMenuItems";

export const useBottomNavItems = () => {
  const { isAuthenticated } = useFrameSession().useSession();

  const plugged = usePluggedMenuItems("bottomNav");
  const items = useMemo(
    () =>
      mergeMenuItems(
        isAuthenticated ? userLayoutUiConfig.bottomMenu.authenticatedMenuItems : userLayoutUiConfig.bottomMenu.guestMenuItems,
        plugged,
        isAuthenticated,
      ),
    [isAuthenticated, plugged],
  );

  return {
    items,
    height: userLayoutConfig.bottomMenu.height,
  };
};
