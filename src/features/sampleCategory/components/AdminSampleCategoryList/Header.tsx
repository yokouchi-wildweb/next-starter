// src/features/sampleCategory/components/AdminSampleCategoryList/Header.tsx

"use client";

import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "../../../../components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { DataMigrationButton } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import config from "@/features/sampleCategory/domain.json";
import { CreateButton } from "@/lib/crud";
import { getAdminPaths } from "@/lib/crud/utils";

const paths = getAdminPaths("sample-categories");
const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;

export type AdminSampleCategoryListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminSampleCategoryListHeader({ page, perPage, total }: AdminSampleCategoryListHeaderProps) {
  const params = useSearchParams();

  return (
    <ListTop title="登録済みサンプルカテゴリの一覧">
      {hasSearch && <SearchBox makeHref={(p) => `${paths.list}?${p.toString()}`} />}
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
          return `${paths.list}?${search.toString()}`;
        }}
      />
      <CreateButton domain="sampleCategory" />
    </ListTop>
  );
}
