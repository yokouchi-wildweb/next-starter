// src/domains/core/user/components/admin/AdminUserManageModal/SummaryTabContent.tsx

"use client";

import { Stack } from "@/components/Layout/Stack";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import type { User, UserLoginRecord } from "@/domains/core/user/entities";
import { formatUserStatusLabel } from "@/domains/core/user/constants/status";
import { formatUserRoleLabel } from "@/domains/core/user/utils/roleHelpers";

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
    <Flex gap="lg" align="start" className="py-2 border-b border-border last:border-b-0">
      <Span size="sm" weight="medium" tone="muted" className="shrink-0 w-32">
        {label}
      </Span>
      <Block className="flex-1 text-sm">{children}</Block>
    </Flex>
  );
}

export function SummaryTabContent({ user }: Props) {
  const loginHistory = user.metadata?.loginHistory ?? [];
  const signupIp = user.signupIp;

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
    <Stack gap="md" padding={{ base: "sm", sm: "md" }}>
      {/* 基本情報 */}
      <Stack gap="none" className="rounded-md border border-border bg-card px-4 py-2">
        <InfoRow label="名前">
          {user.name ?? <Span inline tone="muted" className="italic">{FALLBACK}</Span>}
        </InfoRow>
        <InfoRow label="メールアドレス">
          {user.email ?? <Span inline tone="muted" className="italic">{FALLBACK}</Span>}
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
            <Span inline tone="muted" className="italic">未記録</Span>
          )}
        </InfoRow>
      </Stack>

      {/* ログイン履歴 */}
      <Stack gap="xs">
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
          <Flex align="center" justify="center" className="min-h-[80px] rounded-lg border border-dashed border-border py-4">
            <Para tone="muted" size="sm">ログイン履歴はまだありません</Para>
          </Flex>
        )}
      </Stack>
    </Stack>
  );
}
