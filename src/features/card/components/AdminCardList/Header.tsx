"use client";
// src/features/card/components/AdminCardList/Header.tsx
import AdminListHeader from "@/components/Admin/AdminListHeader";
import Pagination from "@/components/Fanctional/Pagination";
import AdminSearchBox from "@/components/Admin/AdminSearchBox";
import { useSearchParams } from "next/navigation";

type Props = {
  page: number;
  perPage: number;
  total: number;
};
export default function AdminCardListHeader({ page, perPage, total }: Props) {
  const params = useSearchParams();
  return (
    <AdminListHeader title="登録済みカードの一覧" newHref="/admin/cards/new">
      <AdminSearchBox makeHref={(p) => `/admin/cards?${p.toString()}`} />
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `/admin/cards?${search.toString()}`;
        }}
      />
    </AdminListHeader>
  );
}
