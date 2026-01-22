// src/features/core/user/components/UserMyPage/index.tsx

"use client";

import { useCallback } from "react";
import { UserPenIcon, LogOutIcon, PauseCircleIcon, UserXIcon } from "lucide-react";

import { Block } from "@/components/Layout/Block";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { SecTitle } from "@/components/TextBlocks";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { useLogout } from "@/features/core/auth/hooks/useLogout";
import { formatUserRoleLabel, formatUserStatusLabel } from "@/features/core/user/constants";
import type { User } from "@/features/core/user/entities";
import type { UserRoleType } from "@/features/core/user/types";
import { formatDateJa } from "@/utils/date";

import { ActionMenuCard } from "./ActionMenuCard";
import { UserInfoTable, type UserInfoRow } from "./UserInfoTable";

type UserMyPageProps = {
  user: User;
};

function formatLastAuthenticatedAt(date: User["lastAuthenticatedAt"]): string {
  if (!date) {
    return "未認証";
  }

  return formatDateJa(date, {
    format: "YYYY/MM/DD HH:mm",
    fallback: "未認証",
  }) ?? "未認証";
}

export default function UserMyPage({ user }: UserMyPageProps) {
  const { logout, isLoading: isLoggingOut } = useLogout();

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const rows: UserInfoRow[] = [
    { label: "ユーザーID", value: user.id },
    { label: "表示名", value: user.name ?? "未設定" },
    { label: "権限", value: formatUserRoleLabel(user.role, user.role) },
    { label: "ステータス", value: formatUserStatusLabel(user.status, user.status ?? "未設定") },
    { label: "プロバイダータイプ", value: user.providerType },
    { label: "メールアドレス", value: user.email ?? "未設定" },
    { label: "最終認証日時", value: formatLastAuthenticatedAt(user.lastAuthenticatedAt) },
  ];

  return (
    <>
      <Section>
        <Stack space={4}>
          <SecTitle as="h2">メニュー</SecTitle>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ActionMenuCard
              icon={UserPenIcon}
              title="プロフィールを編集"
              description="表示名やメールアドレスを変更"
              href="/profile/edit"
            />
            <ActionMenuCard
              icon={LogOutIcon}
              title={isLoggingOut ? "ログアウト中..." : "ログアウト"}
              description="このアカウントからログアウト"
              onClick={handleLogout}
              disabled={isLoggingOut}
            />
            {APP_FEATURES.user.pauseEnabled && (
              <ActionMenuCard
                icon={PauseCircleIcon}
                title="休会する"
                description="一時的にアカウントを休止"
                href="/settings/pause"
                variant="muted"
              />
            )}
            <ActionMenuCard
              icon={UserXIcon}
              title="退会する"
              description="アカウントを削除"
              href="/settings/withdraw"
              variant="destructive"
            />
          </div>
        </Stack>
      </Section>
      <Section>
        <Stack space={4}>
          <SecTitle as="h2">アカウント情報</SecTitle>
          <Block appearance="outlined" padding="lg">
            <UserInfoTable rows={rows} />
          </Block>
        </Stack>
      </Section>
    </>
  );
}
