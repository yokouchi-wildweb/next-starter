// src/features/coupon/components/AdminCouponList/Table.tsx

"use client";

import type { Coupon } from "@/features/core/coupon/entities";
import DataTable, { TableCellAction, type DataTableColumn } from "@/lib/tableSuite/DataTable";
import EditButton from "@/components/Fanctional/EditButton";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import DuplicateButton from "@/components/Fanctional/DuplicateButton";
import { useDeleteCoupon } from "@/features/core/coupon/hooks/useDeleteCoupon";
import { useDuplicateCoupon } from "@/features/core/coupon/hooks/useDuplicateCoupon";
import config from "@/features/core/coupon/domain.json";
import presenters from "@/features/core/coupon/presenters";
import { useState } from "react";
import CouponDetailModal from "../common/CouponDetailModal";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";

export type AdminCouponListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  coupons?: Coupon[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<Coupon>[] = buildDomainColumns<Coupon>({
  config,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: Coupon) => (
      <TableCellAction>
        <EditButton href={`/admin/coupons/${d.id}/edit`} />
        <DuplicateButton id={d.id} useDuplicate={useDuplicateCoupon} />
        <DeleteButton id={d.id} useDelete={useDeleteCoupon} title="クーポン削除" />
      </TableCellAction>
    ),
  },
});

export default function AdminCouponListTable({ coupons }: AdminCouponListTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <DataTable
        items={coupons ?? []}
        columns={columns}
        getKey={(d) => d.id}
        rowClassName="cursor-pointer"
        onRowClick={(d) => setSelectedId(String(d.id))}
        emptyValueFallback={adminDataTableFallback}
      />
      <CouponDetailModal
        couponId={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
      />
    </>
  );
}
