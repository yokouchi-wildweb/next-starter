// src/features/sampleTag/components/AdminSampleTagList/Table.tsx

"use client";

import type { SampleTag } from "@/features/sampleTag/entities";
import { useMemo } from "react";
import { BulkActionItems, DataTable, RecordSelectionTable, TableCellAction, selectBulkActions, type DataTableColumn } from "@/lib/tableSuite";
import { adminBulkActions } from "@/features/sampleTag/extensions/adminBulkActions";
import { useAdminBulkActionCan } from "@/features/core/user/hooks/useAdminBulkActionCan";
import { EditButton, DeleteButton } from "@/lib/crud/components";
import presenters from "@/features/sampleTag/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { adminConfig } from "@/features/admin/config";
import { domainDisplay as sampleTagDisplay } from "@/features/sampleTag/entities/display";

export type AdminSampleTagListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  sampleTags?: SampleTag[];
};

const { dataTable } = adminConfig;
const adminDataTableFallback = dataTable.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<SampleTag>[] = buildDomainColumns<SampleTag>({
  config: sampleTagDisplay,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: SampleTag) => (
      <TableCellAction>
        <EditButton domain={sampleTagDisplay} id={d.id} />
        <DeleteButton domain={sampleTagDisplay} id={d.id} />
      </TableCellAction>
    ),
  },
});

export default function AdminSampleTagListTable({ sampleTags }: AdminSampleTagListTableProps) {
  // 一括操作: 受け口 adminBulkActions の項目(adminBulkActions/<名前>.tsx。D149)。項目が無ければ素の表
  const can = useAdminBulkActionCan();
  const bulkActionItems = useMemo(() => selectBulkActions(Object.values(adminBulkActions), { can }), [can]);

  if (bulkActionItems.length === 0) {
    return <DataTable
      items={sampleTags ?? []}
      columns={columns}
      getKey={(d) => d.id}
      emptyValueFallback={adminDataTableFallback}
    />;
  }
  return <RecordSelectionTable
    items={sampleTags ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
    // 行に操作のボタンがあるので、選択はチェックボックスだけ
    selectionBehavior="checkbox"
    bulkActions={(selection) => <BulkActionItems items={bulkActionItems} selection={selection} />}
  />;
}
