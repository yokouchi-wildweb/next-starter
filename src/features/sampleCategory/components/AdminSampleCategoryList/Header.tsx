// src/features/sampleCategory/components/AdminSampleCategoryList/Header.tsx

"use client";

import AdminListHeader from "@/components/Admin/AdminListHeader";
import Pagination from "../../../../components/Fanctional/Pagination";
import AdminSearchBox from "@/components/Admin/AdminSearchBox";
import { useSearchParams } from "next/navigation";
import config from "../../domain.json";

export type AdminSampleCategoryListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminSampleCategoryListHeader({ page, perPage, total }: AdminSampleCategoryListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();
  return (
    <AdminListHeader title="登録済みサンプルカテゴリの一覧" newHref="/admin/sample-categories/new">
      {hasSearch && <AdminSearchBox makeHref={(p) => `/admin/sample-categories?${p.toString()}`} />}
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `/admin/sample-categories?${search.toString()}`;
        }}
      />
    </AdminListHeader>
  );
}
