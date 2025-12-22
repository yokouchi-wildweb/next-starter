/**
 * ヘッダーナビゲーションの状態を提供するhook
 *
 * 設定は src/config/user-header.config.ts で管理
 */

import { useMemo } from "react";

import {
  AUTHENTICATED_MENU_ITEMS,
  GUEST_MENU_ITEMS,
  HEADER_NAV_ENABLED,
  LOGOUT_LABEL,
  LOGOUT_REDIRECT_TO,
  SHOW_LOGOUT_BUTTON,
} from "@/config/ui/user-header.config";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useLogout } from "@/features/core/auth/hooks/useLogout";

import type { NavigationMenuItem } from "./MenuItem";

export const useUserMenuItems = () => {
  const { isAuthenticated } = useAuthSession();
  const { logout, isLoading: isLogoutLoading } = useLogout({
    redirectTo: LOGOUT_REDIRECT_TO,
  });

  const navItems = useMemo<NavigationMenuItem[]>(() => {
    // 認証状態に応じてベースメニューを選択
    const baseItems: NavigationMenuItem[] = isAuthenticated
      ? [...AUTHENTICATED_MENU_ITEMS]
      : [...GUEST_MENU_ITEMS];

    // ログアウトボタンを追加（認証済み＆フラグONの場合）
    if (isAuthenticated && SHOW_LOGOUT_BUTTON) {
      baseItems.push({
        key: "logout",
        label: LOGOUT_LABEL,
        onClick: () => void logout(),
        disabled: isLogoutLoading,
      });
    }

    return baseItems;
  }, [isAuthenticated, isLogoutLoading, logout]);

  return {
    navItems,
    enabled: HEADER_NAV_ENABLED,
  };
};
