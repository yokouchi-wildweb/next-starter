// src/domains/core/coupon/components/AdminCouponList/columns.tsx
// クーポンの管理一覧の列を組み立てる公開の関数(上流の列 = 並びとセルの中身)。
// 行のクリックと詳細のモーダルの対象は useAdminCouponListTable が持つ。
// fork は戻り値の配列に自分の列を差し込んで使う(README「管理画面のクーポン一覧」)

import type { Coupon } from "@/domains/core/coupon/entities";
import { TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { EditButton, DeleteButton, DuplicateButton } from "@/lib/crud";
import presenters from "@/domains/core/coupon/couponPresenters";
import { buildDomainColumns } from "@/lib/crud";
import { formatDateJa } from "@/utils/date";
import { truncateJapanese } from "@/utils/string";
import { domainDisplay as couponDisplay } from "@/domains/core/coupon/entities/display";

export function createAdminCouponListColumns(): DataTableColumn<Coupon>[] {
  return buildDomainColumns<Coupon>({
    config: couponDisplay,
    formatDate: formatDateJa,
    truncate: truncateJapanese,
    presenters,
    actionColumn: {
      header: "操作",
      render: (d: Coupon) => (
        <TableCellAction>
          <EditButton domain={couponDisplay} id={d.id} />
          <DuplicateButton domain={couponDisplay} id={d.id} currentName={d.name} />
          <DeleteButton domain={couponDisplay} id={d.id} />
        </TableCellAction>
      ),
    },
  });
}
