// src/features/card/components/AdminCardList/index.tsx

import type { CardWithNames } from "@/features/card/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/TextBlocks";

export type AdminCardListProps = {
  cards: CardWithNames[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminCardList({ cards, page, perPage, total }: AdminCardListProps) {
  return (
    <Section variant="plain">
      <Header page={page} perPage={perPage} total={total} />
      <Table cards={cards} />
    </Section>
  );
}
