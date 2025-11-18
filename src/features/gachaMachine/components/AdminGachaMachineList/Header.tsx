// src/features/gachaMachine/components/AdminGachaMachineList/Header.tsx

"use client";

import ListTop from "../../../../components/Admin/Elements/ListTop";
import Pagination from "../../../../components/Fanctional/Pagination";
import SearchBox from "../../../../components/Admin/Elements/SearchBox";
import { useSearchParams } from "next/navigation";
import config from "../../domain.json";

export type AdminGachaMachineListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminGachaMachineListHeader({ page, perPage, total }: AdminGachaMachineListHeaderProps) {
  const hasSearch = Array.isArray(config.searchFields) && config.searchFields.length > 0;
  const params = useSearchParams();
  return (
    <ListTop title="登録済みガチャマシンの一覧" newHref="/admin/gacha-machines/new">
      {hasSearch && <SearchBox makeHref={(p) => `/admin/gacha-machines?${p.toString()}`} />}
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `/admin/gacha-machines?${search.toString()}`;
        }}
      />
    </ListTop>
  );
}
