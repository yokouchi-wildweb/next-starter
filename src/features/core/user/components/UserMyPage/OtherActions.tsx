// src/features/core/user/components/UserMyPage/OtherActions.tsx

"use client";

import { PauseCircleIcon, UserXIcon } from "lucide-react";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { APP_FEATURES } from "@/config/app/app-features.config";

import { AccountPageHeader } from "./AccountPageHeader";
import { RichMenuCard } from "./RichMenuCard";

export function OtherActions() {
  return (
    <Section>
      <Stack space={4}>
        <AccountPageHeader title="その他の操作" backHref="/mypage" />
        <Stack space={3}>
          {APP_FEATURES.user.pauseEnabled && (
            <RichMenuCard
              icon={PauseCircleIcon}
              title="休会する"
              description="一時的にアカウントを休止"
              href="/settings/pause"
              variant="muted"
              showChevron
            />
          )}
          {APP_FEATURES.user.withdrawEnabled && (
            <RichMenuCard
              icon={UserXIcon}
              title="退会する"
              description="アカウントを削除"
              href="/settings/withdraw"
              variant="destructive"
              showChevron
            />
          )}
        </Stack>
      </Stack>
    </Section>
  );
}
