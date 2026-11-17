// src/features/core/referral/components/AdminInviteList/columns.tsx
// 招待コード発行者の管理一覧の列を組み立てる公開の関数(上流の列 = 並びとセルの中身)。
// 行のクリックと紹介の一覧のモーダルの対象は useAdminInviteListTable が持つ。
// fork は戻り値の配列に自分の列を差し込んで使う(README「管理画面の招待コード一覧」)

import { type DataTableColumn } from "@/lib/tableSuite";
import { formatDateJa } from "@/utils/date";

import type { InviteCodeWithCount } from "../../services/server/wrappers/getInviteCodeListWithCounts";

export function createAdminInviteListColumns(): DataTableColumn<InviteCodeWithCount>[] {
  return [
    {
      header: "招待コード",
      render: (item) => <span className="font-mono text-sm font-medium">{item.coupon.code}</span>,
    },
    {
      header: "発行者",
      render: (item) => <span className="text-sm">{item.issuerName ?? item.coupon.attribution_user_id ?? "-"}</span>,
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
        <span className={item.coupon.status === "active" ? "text-success-text" : "text-muted-foreground"}>
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
}
