// src/domains/core/accountLifecycle/components/OtherActions.tsx

"use client";

import { PauseCircleIcon, UserXIcon } from "lucide-react";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";

import { AccountPageHeader } from "@/domains/core/user/components/common/AccountPageHeader";
import { RichMenuCard } from "@/domains/core/user/components/common/RichMenuCard";

/** 休会・退会の入口。閉じた機能(規則 pause・withdraw)のカードは棚の Link が描かない */
export function OtherActions() {
  return (
    <Section>
      <Stack gap="md">
        <AccountPageHeader title="その他の操作" backHref="/mypage" />
        <Stack gap="sm">
          <RichMenuCard
            icon={PauseCircleIcon}
            title="休会する"
            description="一時的にアカウントを休止"
            href="/mypage/pause"
            variant="muted"
            showChevron
          />
          <RichMenuCard
            icon={UserXIcon}
            title="退会する"
            description="アカウントを削除"
            href="/mypage/withdraw"
            variant="destructive"
            showChevron
          />
        </Stack>
      </Stack>
    </Section>
  );
}
