// 招待コード発行者一覧のヘッダー（検索 + ページネーション）

"use client";

import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "@/components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import { useSearchParams } from "next/navigation";

export type AdminInviteListHeaderProps = {
  page: number;
  perPage: number;
  total: number;
};

export default function AdminInviteListHeader({ page, perPage, total }: AdminInviteListHeaderProps) {
  const params = useSearchParams();

  return (
    <ListTop title="招待コード発行者一覧">
      <SearchBox makeHref={(p) => `/admin/coupons/invite?${p.toString()}`} />
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return `/admin/coupons/invite?${search.toString()}`;
        }}
      />
    </ListTop>
  );
}
