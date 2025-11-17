// src/features/sampleCategory/components/AdminSampleCategoryList/Table.tsx

"use client";

import type { SampleCategory } from "../../entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import EditButton from "../../../../components/Fanctional/EditButton";
import DeleteButton from "../../../../components/Fanctional/DeleteButton";
import { useDeleteSampleCategory } from "@/features/sampleCategory/hooks/useDeleteSampleCategory";
import config from "../../domain.json";
import { buildDomainColumns } from "@/lib/crud";

export type AdminSampleCategoryListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  sampleCategories?: SampleCategory[];
};

const columns: DataTableColumn<SampleCategory>[] = buildDomainColumns<SampleCategory>({
  config,
  actionColumn: {
    header: "操作",
    render: (d: SampleCategory) => (
      <AdminListActionCell>
        <EditButton href={`/admin/sample-categories/${d.id}/edit`} />
        <DeleteButton id={d.id} useDelete={useDeleteSampleCategory} title="サンプルカテゴリ削除" />
      </AdminListActionCell>
    ),
  },
});

export default function AdminSampleCategoryListTable({ sampleCategories }: AdminSampleCategoryListTableProps) {
  return <DataTable
    items={sampleCategories ?? []}
    columns={columns}
    getKey={(d) => d.id}
  />;
}
