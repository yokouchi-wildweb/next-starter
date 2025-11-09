// src/features/title/components/AdminTitleList/index.tsx

import type { Title } from "@/features/title/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/TextBlocks";

export type AdminTitleListProps = {
  titles: Title[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminTitleList({ titles, page, perPage, total }: AdminTitleListProps) {
  return (
    <Section variant="plain">
      <Header page={page} perPage={perPage} total={total} />
      <Table titles={titles} />
    </Section>
  );
}
