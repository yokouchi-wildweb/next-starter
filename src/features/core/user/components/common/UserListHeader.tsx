// src/features/user/components/admin/form/UserListHeader.tsx

"use client";

import { useSearchParams } from "next/navigation";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import Pagination from "@/components/Navigation/Pagination";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import SortSelect from "@/components/AppFrames/Admin/Elements/SortSelect";
import { CreateButton } from "@/lib/crud/components/Buttons";

type Props = {
  title?: string;
  listPath: string;
  page: number;
  perPage: number;
  total: number;
  searchPlaceholder?: string;
  sortBy?: string;
};

const DEFAULT_TITLE = "登録済みユーザーの一覧";
const DEFAULT_PLACEHOLDER = "ユーザー名/メールアドレスで検索";
const DEFAULT_SORT = "createdAt";

const SORT_OPTIONS = [
  { label: "登録日順", value: "createdAt" },
  { label: "更新日順", value: "updatedAt" },
];

const createHref = (basePath: string, search: URLSearchParams) => {
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
};

export default function UserListHeader({
  title = DEFAULT_TITLE,
  listPath,
  page,
  perPage,
  total,
  searchPlaceholder = DEFAULT_PLACEHOLDER,
  sortBy,
}: Props) {
  const params = useSearchParams();

  return (
    <ListTop title={title}>
      <SortSelect
        options={SORT_OPTIONS}
        selected={sortBy}
        defaultValue={DEFAULT_SORT}
        makeHref={(searchParams) => createHref(listPath, searchParams)}
      />
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
      <CreateButton href={`${listPath}/new`} />
    </ListTop>
  );
}
