// src/features/gachaMachine/components/AdminGachaMachineList/index.tsx

import type { GachaMachine } from "../../entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";

export type AdminGachaMachineListProps = {
  gachaMachines: GachaMachine[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminGachaMachineList({
  gachaMachines,
  page,
  perPage,
  total,
}: AdminGachaMachineListProps) {
  return (
    <Section>
      <Header page={page} perPage={perPage} total={total} />
      <Table gachaMachines={gachaMachines} />
    </Section>
  );
}
