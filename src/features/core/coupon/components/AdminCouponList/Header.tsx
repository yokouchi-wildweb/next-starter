// src/features/coupon/components/AdminCouponList/Header.tsx

"use client";

import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "../../../../../components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { DataMigrationButton } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import config from "@/features/core/coupon/domain.json";

export type AdminCouponListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminCouponListHeader({ page, perPage, total }: AdminCouponListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();

  return (
    <ListTop title="登録済みクーポンの一覧" newHref="/admin/coupons/new">
      {hasSearch && <SearchBox makeHref={(p) => `/admin/coupons?${p.toString()}`} />}
      {config.useImportExport === true && (
        <DataMigrationButton domain={config.singular} searchParams={params.toString()} />
      )}
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `/admin/coupons?${search.toString()}`;
        }}
      />
    </ListTop>
  );
}
