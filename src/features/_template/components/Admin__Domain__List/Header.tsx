// src/features/__domain__/components/Admin__Domain__List/Header.tsx

"use client";

import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "../../../../components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { DataMigrationButton } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import config from "@/features/__domain__/domain.json";
import CreateButton from "@/components/Fanctional/CrudButtons/CreateButton";
import { getAdminPaths } from "@/lib/crud/utils";

const paths = getAdminPaths("__domainsSlug__");
const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;

export type Admin__Domain__ListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function Admin__Domain__ListHeader({ page, perPage, total }: Admin__Domain__ListHeaderProps) {
  const params = useSearchParams();

  return (
    <ListTop title="登録済み__DomainLabel__の一覧">
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
      <CreateButton href={paths.new} />
    </ListTop>
  );
}
