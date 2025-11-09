// src/features/cardRarity/components/AdminCardRarityList/Header.tsx

"use client";

import type { Title } from "@/features/title/entities";
import AdminSelectFilter from "@/components/Admin/AdminSelectFilter";
import AdminListHeader from "@/components/Admin/AdminListHeader";
import Pagination from "@/components/Fanctional/Pagination";

type Props = {
  titles: Title[];
  selectedTitleId?: string;
  page: number;
  perPage: number;
  total: number;
};
export default function AdminCardRarityListHeader({
  titles,
  selectedTitleId,
  page,
  perPage,
  total,
}: Props) {
  return (
    <AdminListHeader
      title="登録済みレアリティの一覧"
      newHref="/admin/card-rarities/new"
    >
      <AdminSelectFilter
        options={titles.map((t) => ({ label: t.name, value: t.id }))}
        selected={selectedTitleId}
        paramKey="titleId"
        makeHref={(p) => `/admin/card-rarities?${p.toString()}`}
      />
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) =>
          selectedTitleId
            ? `/admin/card-rarities?titleId=${selectedTitleId}&page=${p}`
            : `/admin/card-rarities?page=${p}`
        }
      />
    </AdminListHeader>
  );
}
