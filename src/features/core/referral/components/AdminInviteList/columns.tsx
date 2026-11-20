// src/features/core/referral/components/AdminInviteList/columns.tsx
// 招待コード発行者の管理一覧の列を組み立てる公開の関数(上流の列 = 並びとセルの中身)。
// 行のクリックと紹介の一覧のモーダルの対象は useAdminInviteListTable が持つ。
// fork は戻り値の配列に自分の列を差し込んで使う(README「招待コード一覧に列を足す」)

import { Span } from "@/components/TextBlocks/Span";
import { type DataTableColumn } from "@/lib/tableSuite";
import { formatDateJa } from "@/utils/date";

import type { InviteCodeWithCount } from "../../services/server/wrappers/getInviteCodeListWithCounts";

export function createAdminInviteListColumns(): DataTableColumn<InviteCodeWithCount>[] {
  return [
    {
      header: "招待コード",
      render: (item) => <Span inline size="sm" weight="medium" className="font-mono">{item.coupon.code}</Span>,
    },
    {
      header: "発行者",
      render: (item) => <Span inline size="sm">{item.issuerName ?? item.coupon.attribution_user_id ?? "-"}</Span>,
    },
    {
      header: "紹介人数",
      render: (item) => (
        <Span inline weight="medium">
          {item.referralCount}
          <Span inline tone="muted">人</Span>
        </Span>
      ),
      align: "right",
    },
    {
      header: "ステータス",
      render: (item) => (
        <Span inline tone={item.coupon.status === "active" ? "success" : "muted"}>
          {item.coupon.status === "active" ? "有効" : "無効"}
        </Span>
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
