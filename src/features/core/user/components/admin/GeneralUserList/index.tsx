// src/features/user/components/admin/GeneralUserList/index.tsx

import type { User } from "@/features/core/user/entities";
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

const DEFAULT_TITLE = "登録済み一般ユーザーの一覧";

export default function GeneralUserList({
  users,
  title = DEFAULT_TITLE,
  newHref,
  listPath,
  page,
  perPage,
  total,
  searchPlaceholder,
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
