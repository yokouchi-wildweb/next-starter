// src/features/notification/components/AdminNotificationList/Table.tsx

"use client";

import type { Notification } from "@/features/notification/entities";
import { DataTable, TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { EditButton, DeleteButton } from "@/lib/crud";
import config from "@/features/notification/domain.json";
import presenters from "@/features/notification/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";

export type AdminNotificationListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  notifications?: Notification[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<Notification>[] = buildDomainColumns<Notification>({
  config,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: Notification) => (
      <TableCellAction>
        <EditButton domain="notification" id={d.id} />
        <DeleteButton domain="notification" id={d.id} />
      </TableCellAction>
    ),
  },
});

export default function AdminNotificationListTable({ notifications }: AdminNotificationListTableProps) {
  return <DataTable
    items={notifications ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
  />;
}
