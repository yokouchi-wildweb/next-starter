// src/features/foo/components/AdminFooList/Table.tsx

"use client";

import type { Foo } from "@/features/foo/entities";
import DataTable, { TableCellAction, type DataTableColumn } from "@/lib/tableSuite/DataTable";
import EditButton from "@/components/Fanctional/EditButton";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import { useDeleteFoo } from "@/features/foo/hooks/useDeleteFoo";
import config from "@/features/foo/domain.json";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui-behavior-config";

export type AdminFooListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  fooes?: Foo[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<Foo>[] = buildDomainColumns<Foo>({
  config,
  actionColumn: {
    header: "操作",
    render: (d: Foo) => (
      <TableCellAction>
        <EditButton href={`/admin/fooes/${d.id}/edit`} />
        <DeleteButton id={d.id} useDelete={useDeleteFoo} title="foo削除" />
      </TableCellAction>
    ),
  },
});

export default function AdminFooListTable({ fooes }: AdminFooListTableProps) {
  return <DataTable
    items={fooes ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
  />;
}
