import { useCallback, useMemo } from "react";

import { useAuthSession } from "@/features/auth/hooks/useAuthSession";
import { useLogout } from "@/features/auth/hooks/useLogout";

import type { NavigationMenuItem } from "./MenuItem";

export const useUserMenuItems = () => {
  const { isAuthenticated } = useAuthSession();
  const { logout, isLoading: isLogoutLoading } = useLogout({ redirectTo: "/login" });

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

  const navItems = useMemo<NavigationMenuItem[]>(
    () =>
      isAuthenticated
        ? [
            { key: "home", label: "ホーム", href: "/" },
            { key: "service", label: "サービス", href: "/services" },
            { key: "mypage", label: "マイページ", href: "/mypage" },
            {
              key: "logout",
              label: "ログアウト",
              onClick: handleLogout,
              disabled: isLogoutLoading,
            },
          ]
        : [
            { key: "home", label: "ホーム", href: "/" },
            { key: "service", label: "サービス", href: "/services" },
            { key: "login", label: "ログイン", href: "/login" },
            { key: "signup", label: "会員登録", href: "/signup" },
          ],
    [handleLogout, isAuthenticated, isLogoutLoading],
  );

  return { navItems };
};
