// src/features/userTag/components/AdminUserTagList/Table.tsx

"use client";

import type { UserTag } from "@/features/core/userTag/entities";
import { DataTable, TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { EditButton, DeleteButton } from "@/lib/crud";
import config from "@/features/core/userTag/domain.json";
import presenters from "@/features/core/userTag/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";

export type AdminUserTagListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  userTags?: UserTag[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<UserTag>[] = buildDomainColumns<UserTag>({
  config,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: UserTag) => (
      <TableCellAction>
        <EditButton domain="userTag" id={d.id} />
        <DeleteButton domain="userTag" id={d.id} />
      </TableCellAction>
    ),
  },
});

export default function AdminUserTagListTable({ userTags }: AdminUserTagListTableProps) {
  return <DataTable
    items={userTags ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
  />;
}
