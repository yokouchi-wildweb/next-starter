// src/features/sampleTag/components/AdminSampleTagList/Header.tsx

"use client";

import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "@/components/Fanctional/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { useSearchParams } from "next/navigation";
import config from "@/features/sampleTag/domain.json";

export type AdminSampleTagListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminSampleTagListHeader({ page, perPage, total }: AdminSampleTagListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();
  return (
    <ListTop title="登録済みサンプルタグの一覧" newHref="/admin/sample-tags/new">
      {hasSearch && <SearchBox makeHref={(p) => `/admin/sample-tags?${p.toString()}`} />}
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `/admin/sample-tags?${search.toString()}`;
        }}
      />
    </ListTop>
  );
}
