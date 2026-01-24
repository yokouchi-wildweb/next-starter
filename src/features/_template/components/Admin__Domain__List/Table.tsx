// src/features/__domain__/components/Admin__Domain__List/Table.tsx

"use client";

import type { __Domain__ } from "@/features/__domain__/entities";
import DataTable, { TableCellAction, type DataTableColumn } from "@/lib/tableSuite/DataTable";
import { EditButton, DeleteButton } from "@/lib/crud";
__DUPLICATE_IMPORT__import config from "@/features/__domain__/domain.json";
import presenters from "@/features/__domain__/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";

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
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: __Domain__) => (
      <TableCellAction>
        <EditButton domain="__domain__" id={d.id} />
        __DUPLICATE_BUTTON__<DeleteButton domain="__domain__" id={d.id} />
      </TableCellAction>
    ),
  },
});

export default function Admin__Domain__ListTable({ __domains__ }: Admin__Domain__ListTableProps) {
  return <DataTable
    items={__domains__ ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
  />;
}
