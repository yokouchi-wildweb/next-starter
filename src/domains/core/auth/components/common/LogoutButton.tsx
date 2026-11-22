// src/domains/core/auth/components/common/LogoutButton.tsx

"use client";

import { useCallback } from "react";

import { Button } from "@/components/Button/Button";
import { useLogout } from "@/domains/core/auth/hooks/useLogout";

type LogoutButtonProps = {
  redirectTo?: string;
};

export function LogoutButton({ redirectTo }: LogoutButtonProps) {
  const { logout, isLoading } = useLogout({ redirectTo });

  const handleClick = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <Button variant="outline" onClick={handleClick} disabled={isLoading}>
      {isLoading ? "ログアウト中..." : "ログアウト"}
    </Button>
  );
}
