// src/features/user/components/admin/ManagerialUserList/index.tsx

import type { User } from "@/features/user/entities";
import { Section } from "@/components/Layout/Section";
import UserListHeader from "../UserListHeader";
import Table from "./Table";

type Props = {
  users: User[];
  title?: string;
  newHref: string;
  listPath: string;
  page: number;
  perPage: number;
  total: number;
  searchPlaceholder?: string;
};

const DEFAULT_TITLE = "登録済みシステム管理者の一覧";
const DEFAULT_PLACEHOLDER = "管理者名またはメールアドレスで検索";

export default function ManagerialUserList({
  users,
  title = DEFAULT_TITLE,
  newHref,
  listPath,
  page,
  perPage,
  total,
  searchPlaceholder = DEFAULT_PLACEHOLDER,
}: Props) {
  return (
    <Section>
      <UserListHeader
        title={title}
        newHref={newHref}
        listPath={listPath}
        page={page}
        perPage={perPage}
        total={total}
        searchPlaceholder={searchPlaceholder}
      />
      <Table users={users} editBasePath={listPath} />
    </Section>
  );
}
