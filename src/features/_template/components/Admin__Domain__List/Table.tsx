// src/features/__domain__/components/Admin__Domain__List/Table.tsx

"use client";

import type { __Domain__ } from "@/features/__domain__/entities";
import { useMemo } from "react";
import { BulkActionItems, DataTable, RecordSelectionTable, TableCellAction, selectBulkActions, type DataTableColumn } from "@/lib/tableSuite";
import { adminBulkActions } from "@/features/__domain__/extensions/adminBulkActions";
import { useAdminBulkActionCan } from "@/features/core/user/hooks/useAdminBulkActionCan";
import { EditButton, DeleteButton } from "@/lib/crud/components";
__DUPLICATE_IMPORT__import presenters from "@/features/__domain__/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { adminConfig } from "@/features/admin/config";
import { domainDisplay as __domain__Display } from "@/features/__domain__/entities/display";

export type Admin__Domain__ListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  __domains__?: __Domain__[];
};

const { dataTable } = adminConfig;
const adminDataTableFallback = dataTable.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<__Domain__>[] = buildDomainColumns<__Domain__>({
  config: __domain__Display,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: __Domain__) => (
      <TableCellAction>
        <EditButton domain={__domain__Display} id={d.id} />
        __DUPLICATE_BUTTON__<DeleteButton domain={__domain__Display} id={d.id} />
      </TableCellAction>
    ),
  },
});

export default function Admin__Domain__ListTable({ __domains__ }: Admin__Domain__ListTableProps) {
  // 一括操作: 受け口 adminBulkActions の項目(adminBulkActions/<名前>.tsx。D149)。項目が無ければ素の表
  const can = useAdminBulkActionCan();
  const bulkActionItems = useMemo(() => selectBulkActions(Object.values(adminBulkActions), { can }), [can]);

  if (bulkActionItems.length === 0) {
    return <DataTable
      items={__domains__ ?? []}
      columns={columns}
      getKey={(d) => d.id}
      emptyValueFallback={adminDataTableFallback}
    />;
  }
  return <RecordSelectionTable
    items={__domains__ ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
    // 行に操作のボタンがあるので、選択はチェックボックスだけ
    selectionBehavior="checkbox"
    bulkActions={(selection) => <BulkActionItems items={bulkActionItems} selection={selection} />}
  />;
}
