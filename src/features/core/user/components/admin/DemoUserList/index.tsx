// src/features/core/user/components/admin/DemoUserList/index.tsx

import type { User } from "@/features/core/user/entities";
import { Section } from "@/components/Layout/Section";
import UserListHeader from "../UserListHeader";
import Table from "./Table";

type Props = {
  users: User[];
  title?: string;
  newHref?: string;
  listPath: string;
  page: number;
  perPage: number;
  total: number;
  searchPlaceholder?: string;
};

const DEFAULT_TITLE = "登録済みデモユーザーの一覧";

export default function DemoUserList({
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
      <Table users={users} />
    </Section>
  );
}
