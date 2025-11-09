// src/features/bar/components/AdminBarList/index.tsx

import type { Bar } from "../../entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/TextBlocks";

export type AdminBarListProps = {
  bars: Bar[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminBarList({
  bars,
  page,
  perPage,
  total,
}: AdminBarListProps) {
  return (
    <Section variant="plain">
      <Header page={page} perPage={perPage} total={total} />
      <Table bars={bars} />
    </Section>
  );
}
