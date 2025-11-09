// src/features/__domain__/components/Admin__Domain__List/Header.tsx

"use client";

import AdminListHeader from "@/components/Admin/AdminListHeader";
import Pagination from "../../../../components/Fanctional/Pagination";
import AdminSearchBox from "@/components/Admin/AdminSearchBox";
import { useSearchParams } from "next/navigation";
import config from "../../domain.json";

export type Admin__Domain__ListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function Admin__Domain__ListHeader({ page, perPage, total }: Admin__Domain__ListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();
  return (
    <AdminListHeader title="登録済み__DomainLabel__の一覧" newHref="/admin/__domainsSlug__/new">
      {hasSearch && <AdminSearchBox makeHref={(p) => `/admin/__domainsSlug__?${p.toString()}`} />}
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `/admin/__domainsSlug__?${search.toString()}`;
        }}
      />
    </AdminListHeader>
  );
}
