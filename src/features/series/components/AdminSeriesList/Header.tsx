// src/features/series/components/AdminSeriesList/Header.tsx

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

export default function AdminSeriesListHeader({
  titles,
  selectedTitleId,
  page,
  perPage,
  total,
}: Props) {
  return (
    <AdminListHeader title="登録済みシリーズの一覧" newHref="/admin/series/new">
      <AdminSelectFilter
        options={titles.map((t) => ({ label: t.name, value: t.id }))}
        selected={selectedTitleId}
        paramKey="titleId"
        makeHref={(p) => `/admin/series?${p.toString()}`}
      />
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) =>
          selectedTitleId ? `/admin/series?titleId=${selectedTitleId}&page=${p}` : `/admin/series?page=${p}`
        }
      />
    </AdminListHeader>
  );
}
