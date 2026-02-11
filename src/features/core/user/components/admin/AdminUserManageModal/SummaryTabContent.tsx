// src/features/core/user/components/admin/AdminUserManageModal/SummaryTabContent.tsx

"use client";

import { Stack } from "@/components/Layout/Stack";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import type { User, UserLoginRecord } from "@/features/core/user/entities";
import { formatUserStatusLabel } from "@/features/core/user/constants/status";
import { formatUserRoleLabel } from "@/features/core/user/utils/roleHelpers";

type Props = {
  user: User;
};

const FALLBACK = "(未設定)";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type InfoRowProps = {
  label: string;
  children: React.ReactNode;
};

function InfoRow({ label, children }: InfoRowProps) {
  return (
    <Flex gap="md" align="start" className="py-2 border-b border-border last:border-b-0">
      <span className="shrink-0 w-32 text-sm font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 text-sm">{children}</div>
    </Flex>
  );
}

export function SummaryTabContent({ user }: Props) {
  const metadata = user.metadata ?? {};
  const loginHistory = metadata.loginHistory ?? [];
  const signupIp = metadata.signupIp;

  const columns: DataTableColumn<UserLoginRecord>[] = [
    {
      header: "日時",
      render: (record) => formatDate(record.at),
    },
    {
      header: "IPアドレス",
      render: (record) => (
        <code className="rounded bg-muted/50 px-1.5 py-0.5 text-xs">
          {record.ip}
        </code>
      ),
    },
  ];

  const hasHistory = loginHistory.length > 0;

  return (
    <Stack space={4} padding="md">
      {/* 基本情報 */}
      <Stack space={0} className="rounded-md border border-border bg-card px-4 py-2">
        <InfoRow label="名前">
          {user.name ?? <span className="text-muted-foreground italic">{FALLBACK}</span>}
        </InfoRow>
        <InfoRow label="メールアドレス">
          {user.email ?? <span className="text-muted-foreground italic">{FALLBACK}</span>}
        </InfoRow>
        <InfoRow label="ステータス">
          {formatUserStatusLabel(user.status, FALLBACK)}
        </InfoRow>
        <InfoRow label="ロール">
          {formatUserRoleLabel(user.role, FALLBACK)}
        </InfoRow>
        <InfoRow label="サインアップ時IP">
          {signupIp ? (
            <code className="rounded bg-muted/50 px-1.5 py-0.5 text-xs">
              {signupIp}
            </code>
          ) : (
            <span className="text-muted-foreground italic">未記録</span>
          )}
        </InfoRow>
      </Stack>

      {/* ログイン履歴 */}
      <Stack space={2}>
        <Para size="sm" className="font-medium">
          直近のログイン履歴（最大10件）
        </Para>
        {hasHistory ? (
          <DataTable
            items={loginHistory}
            columns={columns}
            className="rounded-lg border border-border bg-card"
            maxHeight="none"
            getKey={(_, index) => String(index)}
            emptyValueFallback="-"
          />
        ) : (
          <div className="flex min-h-[80px] items-center justify-center rounded-lg border border-dashed border-border py-4">
            <Para tone="muted" size="sm">ログイン履歴はまだありません</Para>
          </div>
        )}
      </Stack>
    </Stack>
  );
}
