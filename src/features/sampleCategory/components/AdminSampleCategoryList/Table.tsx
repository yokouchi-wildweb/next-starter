// src/features/sampleCategory/components/AdminSampleCategoryList/Table.tsx

"use client";

import type { SampleCategory } from "@/features/sampleCategory/entities";
import DataTable, { TableCellAction, type DataTableColumn } from "@/lib/tableSuite/DataTable";
import { EditButton, DeleteButton } from "@/components/Fanctional";
import { useDeleteSampleCategory } from "@/features/sampleCategory/hooks/useDeleteSampleCategory";
import config from "@/features/sampleCategory/domain.json";
import presenters from "@/features/sampleCategory/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import { getAdminPaths } from "@/lib/crud/utils";

export type AdminSampleCategoryListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  sampleCategories?: SampleCategory[];
};

const paths = getAdminPaths("sample-categories");
const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<SampleCategory>[] = buildDomainColumns<SampleCategory>({
  config,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: SampleCategory) => (
      <TableCellAction>
        <EditButton href={paths.edit(d.id)} />
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
