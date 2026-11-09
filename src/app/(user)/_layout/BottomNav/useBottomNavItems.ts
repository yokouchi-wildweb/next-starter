/**
 * ボトムナビゲーションの状態を提供するhook
 *
 * 項目は枠の描画用の設定 ../config.ui.ts の bottomMenu、高さは ../config.ts の bottomMenu.height
 * バッジは項目の badge で渡す
 */

import { useMemo } from "react";

import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";

import { userLayoutConfig } from "../config";
import { userLayoutUiConfig } from "../config.ui";

export const useBottomNavItems = () => {
  const { isAuthenticated } = useAuthSession();

  const items = useMemo(
    () => (isAuthenticated ? userLayoutUiConfig.bottomMenu.authenticatedMenuItems : userLayoutUiConfig.bottomMenu.guestMenuItems),
    [isAuthenticated],
  );

  return {
    items,
    height: userLayoutConfig.bottomMenu.height,
  };
};
