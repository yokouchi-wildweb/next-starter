// 招待コード発行者一覧テーブル

"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/lib/tableSuite";
import { formatDateJa } from "@/utils/date";
import ReferralListModal from "./ReferralListModal";
import type { InviteCodeWithCount } from "../../services/server/wrappers/getInviteCodeListWithCounts";

export type AdminInviteListTableProps = {
  items?: InviteCodeWithCount[];
};

const columns: DataTableColumn<InviteCodeWithCount>[] = [
  {
    header: "招待コード",
    render: (item) => (
      <span className="font-mono text-sm font-medium">{item.coupon.code}</span>
    ),
  },
  {
    header: "発行者",
    render: (item) => (
      <span className="text-sm">
        {item.issuerName ?? item.coupon.attribution_user_id ?? "-"}
      </span>
    ),
  },
  {
    header: "紹介人数",
    render: (item) => (
      <span className="font-medium">
        {item.referralCount}
        <span className="text-muted-foreground">人</span>
      </span>
    ),
    align: "right",
  },
  {
    header: "ステータス",
    render: (item) => (
      <span
        className={
          item.coupon.status === "active"
            ? "text-green-600"
            : "text-muted-foreground"
        }
      >
        {item.coupon.status === "active" ? "有効" : "無効"}
      </span>
    ),
  },
  {
    header: "発行日",
    render: (item) =>
      formatDateJa(item.coupon.createdAt, {
        format: "YYYY/MM/DD HH:mm",
        fallback: null,
      }) ?? "-",
  },
];

export default function AdminInviteListTable({ items }: AdminInviteListTableProps) {
  const [selected, setSelected] = useState<InviteCodeWithCount | null>(null);

  return (
    <>
      <DataTable
        items={items ?? []}
        columns={columns}
        getKey={(item) => item.coupon.id}
        rowClassName="cursor-pointer"
        onRowClick={(item) => setSelected(item)}
      />
      <ReferralListModal
        inviterUserId={selected?.coupon.attribution_user_id ?? null}
        inviteCode={selected?.coupon.code}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
