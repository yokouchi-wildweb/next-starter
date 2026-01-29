// src/features/user/components/admin/GeneralUserList/index.tsx

import type { User } from "@/features/core/user/entities";
import { Section } from "@/components/Layout/Section";
import UserListHeader from "../../common/UserListHeader";
import Table from "./Table";

type Props = {
  users: User[];
  title?: string;
  listPath: string;
  page: number;
  perPage: number;
  total: number;
  searchPlaceholder?: string;
  sortBy?: string;
};

const DEFAULT_TITLE = "登録済み一般ユーザーの一覧";

export default function GeneralUserList({
  users,
  title = DEFAULT_TITLE,
  listPath,
  page,
  perPage,
  total,
  searchPlaceholder,
  sortBy,
}: Props) {
  return (
    <Section>
      <UserListHeader
        title={title}
        listPath={listPath}
        page={page}
        perPage={perPage}
        total={total}
        searchPlaceholder={searchPlaceholder}
        sortBy={sortBy}
      />
      <Table users={users} editBasePath={listPath} />
    </Section>
  );
}
