// src/features/sampleCategory/components/AdminSampleCategoryList/Table.tsx

"use client";

import type { SampleCategory } from "@/features/sampleCategory/entities";
import { useMemo } from "react";
import { BulkActionItems, DataTable, RecordSelectionTable, TableCellAction, selectBulkActions, type DataTableColumn } from "@/lib/tableSuite";
import { adminBulkActions } from "@/features/sampleCategory/extensions/adminBulkActions";
import { useAdminBulkActionCan } from "@/features/core/user/hooks/useAdminBulkActionCan";
import { EditButton, DeleteButton } from "@/lib/crud/components";
import presenters from "@/features/sampleCategory/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { adminConfig } from "@/features/admin/config";
import { domainDisplay as sampleCategoryDisplay } from "@/features/sampleCategory/entities/display";

export type AdminSampleCategoryListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  sampleCategories?: SampleCategory[];
};

const { dataTable } = adminConfig;
const adminDataTableFallback = dataTable.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<SampleCategory>[] = buildDomainColumns<SampleCategory>({
  config: sampleCategoryDisplay,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: SampleCategory) => (
      <TableCellAction>
        <EditButton domain={sampleCategoryDisplay} id={d.id} />
        <DeleteButton domain={sampleCategoryDisplay} id={d.id} />
      </TableCellAction>
    ),
  },
});

export default function AdminSampleCategoryListTable({ sampleCategories }: AdminSampleCategoryListTableProps) {
  // 一括操作: 受け口 adminBulkActions の項目(adminBulkActions/<名前>.tsx。D149)。項目が無ければ素の表
  const can = useAdminBulkActionCan();
  const bulkActionItems = useMemo(() => selectBulkActions(Object.values(adminBulkActions), { can }), [can]);

  if (bulkActionItems.length === 0) {
    return <DataTable
      items={sampleCategories ?? []}
      columns={columns}
      getKey={(d) => d.id}
      emptyValueFallback={adminDataTableFallback}
    />;
  }
  return <RecordSelectionTable
    items={sampleCategories ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
    // 行に操作のボタンがあるので、選択はチェックボックスだけ
    selectionBehavior="checkbox"
    bulkActions={(selection) => <BulkActionItems items={bulkActionItems} selection={selection} />}
  />;
}
