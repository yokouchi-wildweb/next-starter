// 紹介ユーザー一覧モーダル（行クリック時に表示）

"use client";

import Modal from "@/components/Overlays/Modal";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { BaseSkeleton } from "@/components/Skeleton/BaseSkeleton";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import { useReferralsByInviter } from "@/features/core/referral/hooks/useReferralsByInviter";
import type { ReferralByInviterItem } from "@/features/core/referral/services/client/referralsByInviter";
import { formatDateJa } from "@/utils/date";
import { SolidBadge } from "@/components/Badge";

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
      <span className="text-sm">
        {item.inviteeUserName ?? item.inviteeUserId}
      </span>
    ),
  },
  {
    header: "ステータス",
    render: (item) => (
      <span
        className={
          item.status === "active"
            ? "text-success-text"
            : "text-muted-foreground"
        }
      >
        {item.status === "active" ? "有効" : "取消"}
      </span>
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
      <span className="text-sm text-muted-foreground">
        {item.signupIp ?? "-"}
      </span>
    ),
  },
  {
    header: "達成リワード",
    render: (item) =>
      item.fulfilledRewardGroups.length > 0 ? (
        <span className="flex flex-wrap gap-1">
          {item.fulfilledRewardGroups.map((label) => (
            <SolidBadge key={label} variant="success" size="sm">
              {label}
            </SolidBadge>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">-</span>
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
      <Stack space={4} padding="md">
        {isLoading ? (
          <Stack space={2}>
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
