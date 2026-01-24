// src/features/sampleTag/components/AdminSampleTagList/Table.tsx

"use client";

import type { SampleTag } from "@/features/sampleTag/entities";
import DataTable, { TableCellAction, type DataTableColumn } from "@/lib/tableSuite/DataTable";
import { EditButton, DeleteButton } from "@/components/Fanctional";
import { useDeleteSampleTag } from "@/features/sampleTag/hooks/useDeleteSampleTag";
import config from "@/features/sampleTag/domain.json";
import presenters from "@/features/sampleTag/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import { getAdminPaths } from "@/lib/crud/utils";

export type AdminSampleTagListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  sampleTags?: SampleTag[];
};

const paths = getAdminPaths("sample-tags");
const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<SampleTag>[] = buildDomainColumns<SampleTag>({
  config,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: SampleTag) => (
      <TableCellAction>
        <EditButton href={paths.edit(d.id)} />
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
