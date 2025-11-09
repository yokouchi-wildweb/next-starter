// src/features/title/components/AdminTitleList/Header.tsx

"use client";

import AdminListHeader from "@/components/Admin/AdminListHeader";
import Pagination from "@/components/Fanctional/Pagination";

type Props = {
  page: number;
  perPage: number;
  total: number;
};
export default function AdminTitleListHeader({ page, perPage, total }: Props) {
  return (
    <AdminListHeader title="登録済みタイトルの一覧" newHref="/admin/titles/new">
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => `/admin/titles?page=${p}`}
      />
    </AdminListHeader>
  );
}
