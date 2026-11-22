// 招待コード発行者一覧テーブル
// 処理は useAdminInviteListTable、列は createAdminInviteListColumns。ここは並べるだけ

"use client";

import { useMemo } from "react";

import { DataTable } from "@/lib/tableSuite";
import { useAdminInviteListTable } from "@/domains/core/referral/hooks/useAdminInviteListTable";

import type { InviteCodeWithCount } from "../../services/server/wrappers/getInviteCodeListWithCounts";
import ReferralListModal from "./ReferralListModal";
import { createAdminInviteListColumns } from "./columns";

export type AdminInviteListTableProps = {
  items?: InviteCodeWithCount[];
};

export default function AdminInviteListTable({ items }: AdminInviteListTableProps) {
  const table = useAdminInviteListTable();
  const columns = useMemo(() => createAdminInviteListColumns(), []);

  return (
    <>
      <DataTable items={items ?? []} columns={columns} getKey={(item) => item.coupon.id} {...table.rowProps} />
      <ReferralListModal {...table.modal} />
    </>
  );
}
