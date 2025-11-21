// src/features/__domain__/components/Admin__Domain__List/index.tsx

import type { __Domain__ } from "@/features/_template/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";

export type Admin__Domain__ListProps = {
  __domains__: __Domain__[];
  page: number;
  perPage: number;
  total: number;
};

export default function Admin__Domain__List({
  __domains__,
  page,
  perPage,
  total,
}: Admin__Domain__ListProps) {
  return (
    <Section>
      <Header page={page} perPage={perPage} total={total} />
      <Table __domains__={__domains__} />
    </Section>
  );
}
