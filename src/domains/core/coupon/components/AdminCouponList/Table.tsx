// src/domains/coupon/components/AdminCouponList/Table.tsx
// 処理は useAdminCouponListTable、列は createAdminCouponListColumns。ここは並べるだけ

"use client";

import { useMemo } from "react";

import type { Coupon } from "@/domains/core/coupon/entities";
import { DataTable } from "@/lib/tableSuite";
import { adminConfig } from "@/domains/admin/config";
import { useAdminCouponListTable } from "@/domains/core/coupon/hooks/useAdminCouponListTable";

import CouponDetailModal from "../common/CouponDetailModal";
import { createAdminCouponListColumns } from "./columns";

export type AdminCouponListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  coupons?: Coupon[];
};

const { dataTable } = adminConfig;
const adminDataTableFallback = dataTable.emptyFieldFallback ?? "(未設定)";

export default function AdminCouponListTable({ coupons }: AdminCouponListTableProps) {
  const table = useAdminCouponListTable();
  const columns = useMemo(() => createAdminCouponListColumns(), []);

  return (
    <>
      <DataTable
        items={coupons ?? []}
        columns={columns}
        getKey={(d) => d.id}
        {...table.rowProps}
        emptyValueFallback={adminDataTableFallback}
      />
      <CouponDetailModal {...table.modal} />
    </>
  );
}
