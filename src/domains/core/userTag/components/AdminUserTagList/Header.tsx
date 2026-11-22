// src/domains/userTag/components/AdminUserTagList/Header.tsx

"use client";

import ListTop from "@/components/Admin/ListTop";
import Pagination from "@/components/Navigation/Pagination";
import SearchBox from "@/components/Admin/SearchBox";
import { DataMigrationButton } from "@/lib/dataMigration";
import { useSearchParams } from "next/navigation";
import { CreateButton } from "@/lib/crud";
import { getAdminPaths } from "@/lib/domain";
import { domainDisplay as userTagDisplay } from "@/domains/core/userTag/entities/display";

const paths = getAdminPaths("user-tags");
const hasSearch = userTagDisplay.searchFields.length > 0;

export type AdminUserTagListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminUserTagListHeader({ page, perPage, total }: AdminUserTagListHeaderProps) {
  const params = useSearchParams();

  return (
    <ListTop title="登録済みユーザータグの一覧">
      {hasSearch && <SearchBox makeHref={(p) => `${paths.list}?${p.toString()}`} />}
      {userTagDisplay.useImportExport === true && (
        <DataMigrationButton domain={userTagDisplay} searchParams={params.toString()} />
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
      <CreateButton domain={userTagDisplay} />
    </ListTop>
  );
}
