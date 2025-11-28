// src/features/user/components/admin/form/UserListHeader.tsx

"use client";

import { useSearchParams } from "next/navigation";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "@/components/Fanctional/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";

type Props = {
  title?: string;
  newHref: string;
  listPath: string;
  page: number;
  perPage: number;
  total: number;
  searchPlaceholder?: string;
};

const DEFAULT_TITLE = "登録済みユーザーの一覧";
const DEFAULT_PLACEHOLDER = "ユーザー名またはメールアドレスで検索";

const createHref = (basePath: string, search: URLSearchParams) => {
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
};

export default function UserListHeader({
  title = DEFAULT_TITLE,
  newHref,
  listPath,
  page,
  perPage,
  total,
  searchPlaceholder = DEFAULT_PLACEHOLDER,
}: Props) {
  const params = useSearchParams();

  return (
    <ListTop title={title} newHref={newHref}>
      <SearchBox
        makeHref={(searchParams) => createHref(listPath, searchParams)}
        placeholder={searchPlaceholder}
      />
      <Pagination
        page={page}
        perPage={perPage}
        total={total}
        makeHref={(p) => {
          const search = new URLSearchParams(params.toString());
          search.set("page", String(p));
          return createHref(listPath, search);
        }}
      />
    </ListTop>
  );
}
