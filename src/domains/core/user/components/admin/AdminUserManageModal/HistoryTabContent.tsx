// src/domains/core/user/components/admin/AdminUserManageModal/HistoryTabContent.tsx

"use client";

import { Stack } from "@/components/Layout/Stack";
import { AuditTimeline } from "@/domains/core/auditLog";
import type { User } from "@/domains/core/user/entities";

import { UserInfoHeader } from "./UserInfoHeader";

type Props = {
  user: User;
};

/**
 * ユーザー管理モーダルの履歴タブ。
 * 汎用 AuditTimeline に targetType="user" を渡すだけで履歴表示が完結する。
 */
export function HistoryTabContent({ user }: Props) {
  return (
    <Stack gap="md" padding={{ base: "sm", sm: "md" }}>
      <UserInfoHeader user={user} />
      <Stack gap="lg" className="mt-4">
        <AuditTimeline targetType="user" targetId={user.id} />
      </Stack>
    </Stack>
  );
}
