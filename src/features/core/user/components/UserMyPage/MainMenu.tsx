// src/features/core/user/components/UserMyPage/MainMenu.tsx

"use client";

import { useCallback } from "react";
import { UserCircleIcon, LogOutIcon, PauseCircleIcon, UserXIcon } from "lucide-react";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { useLogout } from "@/features/core/auth/hooks/useLogout";

import { RichMenuCard } from "./RichMenuCard";

export function MainMenu() {
  const { logout, isLoading: isLoggingOut } = useLogout();

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  return (
    <Section>
      <Stack space={3}>
        <RichMenuCard
          icon={UserCircleIcon}
          title="アカウント基本情報"
          description="ユーザー名、メールアドレスを確認・編集"
          href="/mypage/account"
          showChevron
        />
        <RichMenuCard
          icon={LogOutIcon}
          title={isLoggingOut ? "ログアウト中..." : "ログアウト"}
          description="このアカウントからログアウト"
          onClick={handleLogout}
          disabled={isLoggingOut}
        />
        {APP_FEATURES.user.pauseEnabled && (
          <RichMenuCard
            icon={PauseCircleIcon}
            title="休会する"
            description="一時的にアカウントを休止"
            href="/settings/pause"
            variant="muted"
          />
        )}
        {APP_FEATURES.user.withdrawEnabled && (
          <RichMenuCard
            icon={UserXIcon}
            title="退会する"
            description="アカウントを削除"
            href="/settings/withdraw"
            variant="destructive"
          />
        )}
      </Stack>
    </Section>
  );
}
