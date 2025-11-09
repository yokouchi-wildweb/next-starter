// src/features/cardRarity/components/AdminCardRarityList/index.tsx

import type { CardRarityWithTitle } from "@/features/cardRarity/entities";
import type { Title } from "@/features/title/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/TextBlocks";

export type AdminCardRarityListProps = {
  rarities: CardRarityWithTitle[];
  titles: Title[];
  selectedTitleId?: string;
  page: number;
  perPage: number;
  total: number;
};

export default function AdminCardRarityList({ rarities, titles, selectedTitleId, page, perPage, total }: AdminCardRarityListProps) {
  return (
    <Section variant="plain">
      <Header titles={titles} selectedTitleId={selectedTitleId} page={page} perPage={perPage} total={total} />
      <Table rarities={rarities} />
    </Section>
  );
}
