// src/features/coupon/components/AdminCouponList/Header.tsx

"use client";

import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "../../../../../components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { DataMigrationButton } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import config from "@/features/core/coupon/domain.json";
import CreateButton from "@/components/Fanctional/CrudButtons/CreateButton";

export type AdminCouponListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminCouponListHeader({ page, perPage, total }: AdminCouponListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();

  return (
    <ListTop title="発行済の公式クーポン">
      {hasSearch && <SearchBox makeHref={(p) => `/admin/coupons/official?${p.toString()}`} />}
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
          return `/admin/coupons/official?${search.toString()}`;
        }}
      />
      <CreateButton href="/admin/coupons/new" />
    </ListTop>
  );
}
