// src/features/user/components/admin/ManagerialUserList/index.tsx

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

const DEFAULT_TITLE = "登録済みシステム管理者の一覧";
const DEFAULT_PLACEHOLDER = "管理者名またはメールアドレスで検索";

export default function ManagerialUserList({
  users,
  title = DEFAULT_TITLE,
  listPath,
  page,
  perPage,
  total,
  searchPlaceholder = DEFAULT_PLACEHOLDER,
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
