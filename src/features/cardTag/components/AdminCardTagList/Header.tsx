// src/features/cardTag/components/AdminCardTagList/Header.tsx

"use client";

import AdminListHeader from "@/components/Admin/AdminListHeader";
import Pagination from "@/components/Fanctional/Pagination";

type Props = {
  page: number;
  perPage: number;
  total: number;
};
export default function AdminCardTagListHeader({ page, perPage, total }: Props) {
  return (
    <AdminListHeader title="登録済みカードタグの一覧" newHref="/admin/card-tags/new">
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => `/admin/card-tags?page=${p}`}
      />
    </AdminListHeader>
  );
}
