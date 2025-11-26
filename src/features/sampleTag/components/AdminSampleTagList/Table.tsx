// src/features/sampleTag/components/AdminSampleTagList/Table.tsx

"use client";

import type { SampleTag } from "@/features/sampleTag/entities";
import DataTable, { TableCellAction, type DataTableColumn } from "@/lib/tableSuite/DataTable";
import EditButton from "@/components/Fanctional/EditButton";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import { useDeleteSampleTag } from "@/features/sampleTag/hooks/useDeleteSampleTag";
import config from "@/features/sampleTag/domain.json";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui-behavior-config";

export type AdminSampleTagListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  sampleTags?: SampleTag[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<SampleTag>[] = buildDomainColumns<SampleTag>({
  config,
  actionColumn: {
    header: "操作",
    render: (d: SampleTag) => (
      <TableCellAction>
        <EditButton href={`/admin/sample-tags/${d.id}/edit`} />
        <DeleteButton id={d.id} useDelete={useDeleteSampleTag} title="サンプルタグ削除" />
      </TableCellAction>
    ),
  },
});

export default function AdminSampleTagListTable({ sampleTags }: AdminSampleTagListTableProps) {
  return <DataTable
    items={sampleTags ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
  />;
}
