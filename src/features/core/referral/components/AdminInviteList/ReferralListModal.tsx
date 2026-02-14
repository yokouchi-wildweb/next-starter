// 紹介ユーザー一覧モーダル（行クリック時に表示）

"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Overlays/Modal";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import { BaseSkeleton } from "@/components/Skeleton/BaseSkeleton";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import {
  getReferralsByInviter,
  type ReferralByInviterItem,
} from "../../services/client/referralsByInviter";
import { formatDateJa } from "@/utils/date";

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
    header: "被招待者ID",
    render: (item) => (
      <span className="font-mono text-xs">{item.inviteeUserId}</span>
    ),
  },
  {
    header: "ステータス",
    render: (item) => (
      <span
        className={
          item.status === "active"
            ? "text-green-600"
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
];

export default function ReferralListModal({
  inviterUserId,
  inviteCode,
  open,
  onOpenChange,
}: ReferralListModalProps) {
  const [referrals, setReferrals] = useState<ReferralByInviterItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !inviterUserId) return;

    setIsLoading(true);
    setError(null);

    getReferralsByInviter(inviterUserId)
      .then((res) => setReferrals(res.referrals))
      .catch(() => setError("紹介一覧の取得に失敗しました。"))
      .finally(() => setIsLoading(false));
  }, [open, inviterUserId]);

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
          <Para tone="error">{error}</Para>
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
