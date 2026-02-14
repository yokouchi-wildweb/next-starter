// src/features/core/user/components/UserMyPage/MainMenu.tsx

"use client";

import { useCallback } from "react";
import { UserCircleIcon, LogOutIcon, EllipsisIcon, GiftIcon } from "lucide-react";
import { APP_FEATURES } from "@/config/app/app-features.config";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
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
        {APP_FEATURES.marketing.referral.enabled && (
          <RichMenuCard
            icon={GiftIcon}
            title="招待コードを取得"
            description="お友だちを招待して特典を獲得"
            href="/mypage/invite"
            showChevron
          />
        )}
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
        <RichMenuCard
          icon={EllipsisIcon}
          title="その他の操作"
          description="アカウントに関するその他の操作"
          href="/mypage/other"
          variant="muted"
          showChevron
        />
      </Stack>
    </Section>
  );
}
