// src/features/sampleCategory/components/AdminSampleCategoryList/Table.tsx

"use client";

import type { SampleCategory } from "@/features/sampleCategory/entities";
import { DataTable, TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { EditButton, DeleteButton } from "@/lib/crud";
import config from "@/features/sampleCategory/domain.json";
import presenters from "@/features/sampleCategory/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";

export type AdminSampleCategoryListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  sampleCategories?: SampleCategory[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<SampleCategory>[] = buildDomainColumns<SampleCategory>({
  config,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: SampleCategory) => (
      <TableCellAction>
        <EditButton domain="sampleCategory" id={d.id} />
        <DeleteButton domain="sampleCategory" id={d.id} />
      </TableCellAction>
    ),
  },
});

export default function AdminSampleCategoryListTable({ sampleCategories }: AdminSampleCategoryListTableProps) {
  return <DataTable
    items={sampleCategories ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
  />;
}
