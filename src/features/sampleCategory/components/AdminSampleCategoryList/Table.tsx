// src/features/sampleCategory/components/AdminSampleCategoryList/Table.tsx

"use client";

import type { SampleCategory } from "@/features/sampleCategory/entities";
import DataTable, { TableCellAction, type DataTableColumn } from "@/lib/tableSuite/DataTable";
import EditButton from "@/components/Fanctional/EditButton";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import { useDeleteSampleCategory } from "@/features/sampleCategory/hooks/useDeleteSampleCategory";
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
        <EditButton href={`/admin/sample-categories/${d.id}/edit`} />
        <DeleteButton id={d.id} useDelete={useDeleteSampleCategory} title="サンプルカテゴリ削除" />
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
