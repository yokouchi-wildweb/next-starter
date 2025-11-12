// src/features/sampleCategory/components/AdminSampleCategoryList/index.tsx

import type { SampleCategory } from "../../entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";

export type AdminSampleCategoryListProps = {
  sampleCategories: SampleCategory[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminSampleCategoryList({
  sampleCategories,
  page,
  perPage,
  total,
}: AdminSampleCategoryListProps) {
  return (
    <Section>
      <Header page={page} perPage={perPage} total={total} />
      <Table sampleCategories={sampleCategories} />
    </Section>
  );
}
