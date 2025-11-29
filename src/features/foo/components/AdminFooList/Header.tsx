// src/features/foo/components/AdminFooList/Header.tsx

"use client";

import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "@/components/Fanctional/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { useSearchParams } from "next/navigation";
import config from "@/features/foo/domain.json";

export type AdminFooListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminFooListHeader({ page, perPage, total }: AdminFooListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();
  return (
    <ListTop title="登録済みfooの一覧" newHref="/admin/fooes/new">
      {hasSearch && <SearchBox makeHref={(p) => `/admin/fooes?${p.toString()}`} />}
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `/admin/fooes?${search.toString()}`;
        }}
      />
    </ListTop>
  );
}
