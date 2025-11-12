// src/features/sample/components/AdminSampleList/index.tsx

import type { Sample } from "../../entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";

export type AdminSampleListProps = {
  samples: Sample[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminSampleList({
  samples,
  page,
  perPage,
  total,
}: AdminSampleListProps) {
  return (
    <Section>
      <Header page={page} perPage={perPage} total={total} />
      <Table samples={samples} />
    </Section>
  );
}
