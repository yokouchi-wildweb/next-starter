import { useCallback, useMemo } from "react";

import { useAuthSession } from "@/features/auth/hooks/useAuthSession";
import { useLogout } from "@/features/auth/hooks/useLogout";

import type { NavItem } from "./types";

export const useUserNavItems = () => {
  const { isAuthenticated } = useAuthSession();
  const { logout, isLoading: isLogoutLoading } = useLogout({ redirectTo: "/login" });

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

  const navItems = useMemo<NavItem[]>(
    () =>
      isAuthenticated
        ? [
            { key: "home", type: "link", label: "ホーム", href: "/" },
            { key: "service", type: "link", label: "サービス", href: "/services" },
            { key: "mypage", type: "link", label: "マイページ", href: "/mypage" },
            {
              key: "logout",
              type: "action",
              label: "ログアウト",
              onClick: handleLogout,
              disabled: isLogoutLoading,
            },
          ]
        : [
            { key: "home", type: "link", label: "ホーム", href: "/" },
            { key: "service", type: "link", label: "サービス", href: "/services" },
            { key: "login", type: "link", label: "ログイン", href: "/login" },
            { key: "signup", type: "link", label: "会員登録", href: "/signup" },
          ],
    [handleLogout, isAuthenticated, isLogoutLoading],
  );

  return { navItems };
};
