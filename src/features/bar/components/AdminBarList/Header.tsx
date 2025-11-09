// src/features/bar/components/AdminBarList/Header.tsx

"use client";

import AdminListHeader from "@/components/Admin/AdminListHeader";
import Pagination from "@/components/Fanctional/Pagination";
import AdminSearchBox from "@/components/Admin/AdminSearchBox";
import { useSearchParams } from "next/navigation";
import config from "../../domain.json";

export type AdminBarListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminBarListHeader({ page, perPage, total }: AdminBarListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();
  return (
    <AdminListHeader title="登録済みBarの一覧" newHref="/admin/bars/new">
      {hasSearch && <AdminSearchBox makeHref={(p) => `/admin/bars?${p.toString()}`} />}
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `/admin/bars?${search.toString()}`;
        }}
      />
    </AdminListHeader>
  );
}
