// src/features/sampleTag/components/AdminSampleTagList/index.tsx

import type { SampleTag } from "@/features/sampleTag/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";

export type AdminSampleTagListProps = {
  sampleTags: SampleTag[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminSampleTagList({
  sampleTags,
  page,
  perPage,
  total,
}: AdminSampleTagListProps) {
  return (
    <Section>
      <Header page={page} perPage={perPage} total={total} />
      <Table sampleTags={sampleTags} />
    </Section>
  );
}
