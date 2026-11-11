// src/features/user/components/admin/form/UserListHeader.tsx

"use client";

import { useSearchParams } from "next/navigation";
import ListTop from "@/components/AppFrames/Admin/Elements/ListTop";
import { Pagination } from "@/components/Navigation";
import SearchBox from "@/components/AppFrames/Admin/Elements/SearchBox";
import SortSelect from "@/components/AppFrames/Admin/Elements/SortSelect";
import { CreateButton } from "@/lib/crud/components/Buttons";

export type UserListSortOption = { label: string; value: string };

type Props = {
  title?: string;
  listPath: string;
  page: number;
  perPage: number;
  total: number;
  searchPlaceholder?: string;
  sortBy?: string;
  /** 並び替えの候補(既定 = DEFAULT_USER_LIST_SORT_OPTIONS: 登録日順・更新日順)。fork は値を足して渡す */
  sortOptions?: UserListSortOption[];
  /** sortBy が無いときに選ばれている値(既定 "createdAt")。loader の既定の並びと揃える */
  defaultSort?: string;
};

const DEFAULT_TITLE = "登録済みユーザーの一覧";
const DEFAULT_PLACEHOLDER = "ユーザー名などで検索";
const DEFAULT_SORT = "createdAt";

export const DEFAULT_USER_LIST_SORT_OPTIONS: UserListSortOption[] = [
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
  sortOptions = DEFAULT_USER_LIST_SORT_OPTIONS,
  defaultSort = DEFAULT_SORT,
}: Props) {
  const params = useSearchParams();

  return (
    <ListTop title={title}>
      <SortSelect
        options={sortOptions}
        selected={sortBy}
        defaultValue={defaultSort}
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
