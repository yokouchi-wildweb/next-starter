// src/app/admin/(protected)/bank-transfer-reviews/_components/BankTransferReviewTable.tsx
//
// 銀行振込レビュー一覧テーブル。
// 行クリックで詳細モーダルを開く想定（操作列は持たない）。
// レビュー側の status はタブで切り替えるため列としては表示しない。

"use client";

import { useMemo } from "react";

import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import { SoftBadge } from "@/components/Badge/SoftBadge";
import type {
  AdminBankTransferReviewListItem,
  BankTransferReviewMode,
} from "@/features/core/bankTransferReview";

import {
  formatBankTransferDate,
  formatJpyAmount,
  formatModeLabel,
  formatPurchaseRequestStatusLabel,
  modeBadgeVariant,
  purchaseRequestStatusBadgeVariant,
} from "./formatters";

type Props = {
  items: AdminBankTransferReviewListItem[];
  onSelect: (reviewId: string) => void;
};

export function BankTransferReviewTable({ items, onSelect }: Props) {
  const columns = useMemo<DataTableColumn<AdminBankTransferReviewListItem>[]>(
    () => [
      {
        header: "申告日時",
        render: (item) => formatBankTransferDate(item.review.submitted_at),
        width: "160px",
      },
      {
        header: "ステータス",
        render: (item) => {
          const status = item.purchaseRequest?.status;
          return status ? (
            <SoftBadge
              variant={purchaseRequestStatusBadgeVariant(status)}
              size="sm"
            >
              {formatPurchaseRequestStatusLabel(status)}
            </SoftBadge>
          ) : (
            "-"
          );
        },
        width: "140px",
      },
      {
        header: "モード",
        render: (item) => (
          <SoftBadge
            variant={modeBadgeVariant(item.review.mode as BankTransferReviewMode)}
            size="sm"
          >
            {formatModeLabel(item.review.mode as BankTransferReviewMode)}
          </SoftBadge>
        ),
        width: "140px",
      },
      {
        header: "ユーザー名",
        render: (item) => item.user?.name ?? "(名前未設定)",
      },
      {
        header: "メールアドレス",
        render: (item) => item.user?.email ?? "(メール未設定)",
      },
      {
        header: "振込金額",
        render: (item) =>
          item.purchaseRequest
            ? formatJpyAmount(item.purchaseRequest.payment_amount)
            : "-",
        align: "right",
        width: "120px",
      },
      {
        header: "識別子",
        render: (item) => item.purchaseRequest?.provider_order_id ?? "-",
        width: "120px",
      },
    ],
    [],
  );

  return (
    <DataTable
      items={items}
      columns={columns}
      getKey={(item) => item.review.id}
      className="rounded-lg border border-border bg-card"
      emptyValueFallback="-"
      onRowClick={(item) => onSelect(item.review.id)}
    />
  );
}
