// src/features/series/components/AdminSeriesList/index.tsx

import type { Series } from "@/features/series/entities";
import type { Title } from "@/features/title/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/TextBlocks";

export type AdminSeriesListProps = {
  series: Series[];
  titles: Title[];
  selectedTitleId?: string;
  page: number;
  perPage: number;
  total: number;
};
export default function AdminSeriesList({
  series,
  titles,
  selectedTitleId,
  page,
  perPage,
  total,
}: AdminSeriesListProps) {
  return (
    <Section variant="plain">
      <Header titles={titles} selectedTitleId={selectedTitleId} page={page} perPage={perPage} total={total} />
      <Table series={series} />
    </Section>
  );
}
