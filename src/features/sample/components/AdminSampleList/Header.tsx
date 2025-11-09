// src/features/sample/components/AdminSampleList/Header.tsx

"use client";

import AdminListHeader from "@/components/Admin/AdminListHeader";
import Pagination from "../../../../components/Fanctional/Pagination";
import AdminSearchBox from "@/components/Admin/AdminSearchBox";
import { useSearchParams } from "next/navigation";
import config from "../../domain.json";

export type AdminSampleListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminSampleListHeader({ page, perPage, total }: AdminSampleListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();
  return (
    <AdminListHeader title="登録済みサンプルの一覧" newHref="/admin/samples/new">
      {hasSearch && <AdminSearchBox makeHref={(p) => `/admin/samples?${p.toString()}`} />}
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `/admin/samples?${search.toString()}`;
        }}
      />
    </AdminListHeader>
  );
}
