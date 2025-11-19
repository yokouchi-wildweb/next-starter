// src/features/__domain__/components/Admin__Domain__List/Table.tsx

"use client";

import type { __Domain__ } from "../../entities";
import DataTable, { TableCellAction, DataTableColumn } from "@/components/DataTable";
import EditButton from "../../../../components/Fanctional/EditButton";
import DeleteButton from "../../../../components/Fanctional/DeleteButton";
import { useDelete__Domain__ } from "@/features/__domain__/hooks/useDelete__Domain__";
import config from "../../domain.json";
import { useState } from "react";
import __Domain__DetailModal from "../common/__Domain__DetailModal";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui-behavior-config";

export type Admin__Domain__ListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  __domains__?: __Domain__[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<__Domain__>[] = buildDomainColumns<__Domain__>({
  config,
  actionColumn: {
    header: "操作",
    render: (d: __Domain__) => (
      <TableCellAction>
        <EditButton href={`/admin/__domainsSlug__/${d.id}/edit`} stopPropagation />
        <span onClick={(e) => e.stopPropagation()}>
          <DeleteButton id={d.id} useDelete={useDelete__Domain__} title="__DomainLabel__削除" />
        </span>
      </TableCellAction>
    ),
  },
});

export default function Admin__Domain__ListTable({ __domains__ }: Admin__Domain__ListTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <DataTable
        items={__domains__ ?? []}
        columns={columns}
        getKey={(d) => d.id}
        rowClassName="cursor-pointer"
        onRowClick={(d) => setSelectedId(String(d.id))}
        emptyValueFallback={adminDataTableFallback}
      />
      <__Domain__DetailModal
        __domain__Id={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
      />
    </>
  );
}
