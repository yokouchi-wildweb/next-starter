/**
 * ボトムナビゲーションの状態を提供するhook
 *
 * 設定は src/config/user-bottom-menu.config.ts で管理
 */

import { useMemo } from "react";

import {
  AUTHENTICATED_MENU_ITEMS,
  BOTTOM_NAV_ENABLED,
  BOTTOM_NAV_HEIGHT,
  GUEST_MENU_ITEMS,
} from "@/config/ui/user-bottom-menu.config";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";

export const useBottomNavItems = () => {
  const { isAuthenticated } = useAuthSession();

  const items = useMemo(
    () => (isAuthenticated ? AUTHENTICATED_MENU_ITEMS : GUEST_MENU_ITEMS),
    [isAuthenticated],
  );

  return {
    items,
    height: BOTTOM_NAV_HEIGHT,
    enabled: BOTTOM_NAV_ENABLED,
  };
};
