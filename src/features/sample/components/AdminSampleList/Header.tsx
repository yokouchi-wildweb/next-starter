// src/features/sample/components/AdminSampleList/Header.tsx

"use client";

import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "../../../../components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { DataMigrationButton } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import config from "@/features/sample/domain.json";
import CreateButton from "@/components/Fanctional/CrudButtons/CreateButton";

export type AdminSampleListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminSampleListHeader({ page, perPage, total }: AdminSampleListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();

  return (
    <ListTop title="登録済みサンプルの一覧">
      {hasSearch && <SearchBox makeHref={(p) => `/admin/samples?${p.toString()}`} />}
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
          return `/admin/samples?${search.toString()}`;
        }}
      />
      <CreateButton href="/admin/samples/new" />
    </ListTop>
  );
}
