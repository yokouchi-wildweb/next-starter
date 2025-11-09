// src/features/cardTag/components/AdminCardTagList/index.tsx

import type { CardTag } from "@/features/cardTag/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/TextBlocks";

export type AdminCardTagListProps = {
  cardTags: CardTag[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminCardTagList({ cardTags, page, perPage, total }: AdminCardTagListProps) {
  return (
    <Section variant="plain">
      <Header page={page} perPage={perPage} total={total} />
      <Table cardTags={cardTags} />
    </Section>
  );
}
