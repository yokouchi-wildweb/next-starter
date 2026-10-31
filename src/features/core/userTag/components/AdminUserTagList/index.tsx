// src/features/userTag/components/AdminUserTagList/index.tsx

import type { UserTag } from "@/features/core/userTag/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";
export { default as AdminUserTagListHeader } from "./Header";
export { default as AdminUserTagListTable } from "./Table";

export type AdminUserTagListProps = {
  userTags: UserTag[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminUserTagList({
  userTags,
  page,
  perPage,
  total,
}: AdminUserTagListProps) {
  return (
    <Section>
      <Header page={page} perPage={perPage} total={total} />
      <Table userTags={userTags} />
    </Section>
  );
}
