// src/features/sample/components/AdminSampleList/Header.tsx

"use client";

import Link from "next/link";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import { Pagination } from "@/components/Navigation";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { DataMigrationButton } from "@/lib/dataMigration";
import { Button } from "@/components/Form/Button/Button";
import { useSearchParams } from "next/navigation";
import { normalizeDomainJsonConfig } from "@/lib/domain/config/normalizeDomainJsonConfig";
import rawConfig from "@/features/sample/domain.json";

const config = normalizeDomainJsonConfig(rawConfig);
import { CreateButton } from "@/lib/crud";
import { getAdminPaths } from "@/lib/crud/utils";

const paths = getAdminPaths("samples");
const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;

export type AdminSampleListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminSampleListHeader({ page, perPage, total }: AdminSampleListHeaderProps) {
  const params = useSearchParams();

  return (
    <ListTop title="登録済みサンプルの一覧">
      {hasSearch && <SearchBox makeHref={(p) => `${paths.list}?${p.toString()}`} />}
      {"useImportExport" in config && config.useImportExport === true && (
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
      {"sortOrderField" in config && Boolean(config.sortOrderField) && (
        <Button variant="outline" asChild>
          <Link href={`${paths.list}/sort`}>並び替え</Link>
        </Button>
      )}
      <CreateButton domain="sample" />
    </ListTop>
  );
}
