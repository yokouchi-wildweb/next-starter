// src/domains/userTag/components/AdminUserTagList/Table.tsx

"use client";

import type { UserTag } from "@/domains/core/userTag/entities";
import { DataTable, TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { EditButton, DeleteButton } from "@/lib/crud";
import presenters from "@/domains/core/userTag/userTagPresenters";
import { buildDomainColumns } from "@/lib/crud";
import { formatDateJa } from "@/utils/date";
import { truncateJapanese } from "@/utils/string";
import { adminConfig } from "@/domains/admin/config";
import { domainDisplay as userTagDisplay } from "@/domains/core/userTag/entities/display";

export type AdminUserTagListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  userTags?: UserTag[];
};

const { dataTable } = adminConfig;
const adminDataTableFallback = dataTable.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<UserTag>[] = buildDomainColumns<UserTag>({
  config: userTagDisplay,
  formatDate: formatDateJa,
  truncate: truncateJapanese,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: UserTag) => (
      <TableCellAction>
        <EditButton domain={userTagDisplay} id={d.id} />
        <DeleteButton domain={userTagDisplay} id={d.id} />
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
