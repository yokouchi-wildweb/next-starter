// 紹介ユーザー一覧モーダル（行クリック時に表示）

"use client";

import Modal from "@/components/Overlays/Modal";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { BaseSkeleton } from "@/components/Skeleton/BaseSkeleton";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import { useReferralsByInviter } from "@/domains/core/referral/hooks/useReferralsByInviter";
import type { ReferralByInviterItem } from "@/domains/core/referral/services/client/referralsByInviter";
import { formatDateJa } from "@/utils/date";
import { SolidBadge } from "@/components/Badge/SolidBadge";

export type ReferralListModalProps = {
  /** 招待者のユーザーID */
  inviterUserId: string | null;
  /** 招待コード */
  inviteCode?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const columns: DataTableColumn<ReferralByInviterItem>[] = [
  {
    header: "被招待者",
    render: (item) => (
      <Span inline size="sm">
        {item.inviteeUserName ?? item.inviteeUserId}
      </Span>
    ),
  },
  {
    header: "ステータス",
    render: (item) => (
      <Span inline tone={item.status === "active" ? "success" : "muted"}>
        {item.status === "active" ? "有効" : "取消"}
      </Span>
    ),
  },
  {
    header: "紹介日時",
    render: (item) =>
      formatDateJa(item.createdAt, {
        format: "YYYY/MM/DD HH:mm",
        fallback: null,
      }) ?? "-",
  },
  {
    header: "サインアップIP",
    render: (item) => (
      <Span inline size="sm" tone="muted">
        {item.signupIp ?? "-"}
      </Span>
    ),
  },
  {
    header: "達成リワード",
    render: (item) =>
      item.fulfilledRewardGroups.length > 0 ? (
        <Flex wrap="wrap" gap="2xs">
          {item.fulfilledRewardGroups.map((label) => (
            <SolidBadge key={label} variant="success" size="sm">
              {label}
            </SolidBadge>
          ))}
        </Flex>
      ) : (
        <Span inline tone="muted">-</Span>
      ),
  },
];

export default function ReferralListModal({
  inviterUserId,
  inviteCode,
  open,
  onOpenChange,
}: ReferralListModalProps) {
  const { referrals = [], isLoading, error } = useReferralsByInviter(inviterUserId, {
    enabled: open,
  });

  const title = inviteCode
    ? `紹介一覧 — ${inviteCode}`
    : "紹介一覧";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      maxWidth={640}
      maxHeight="70vh"
    >
      <Stack gap="md" padding={{ base: "sm", sm: "md" }}>
        {isLoading ? (
          <Stack gap="xs">
            <BaseSkeleton className="h-8 w-full" />
            <BaseSkeleton className="h-8 w-full" />
            <BaseSkeleton className="h-8 w-full" />
          </Stack>
        ) : error ? (
          <Para tone="destructive">紹介一覧の取得に失敗しました。</Para>
        ) : referrals.length === 0 ? (
          <Para tone="muted" className="py-8 text-center">
            まだ紹介実績がありません
          </Para>
        ) : (
          <DataTable
            items={referrals}
            columns={columns}
            getKey={(item) => item.id}
          />
        )}
      </Stack>
    </Modal>
  );
}
