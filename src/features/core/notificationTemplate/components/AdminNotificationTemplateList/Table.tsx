// src/features/notificationTemplate/components/AdminNotificationTemplateList/Table.tsx

"use client";

import type { NotificationTemplate } from "@/features/core/notificationTemplate/entities";
import { DataTable, TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { EditButton, DeleteButton } from "@/lib/crud";
import config from "@/features/core/notificationTemplate/domain.json";
import presenters from "@/features/core/notificationTemplate/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";

export type AdminNotificationTemplateListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  notificationTemplates?: NotificationTemplate[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<NotificationTemplate>[] = buildDomainColumns<NotificationTemplate>({
  config,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: NotificationTemplate) => (
      <TableCellAction>
        <EditButton domain="notificationTemplate" id={d.id} />
        <DeleteButton domain="notificationTemplate" id={d.id} />
      </TableCellAction>
    ),
  },
});

export default function AdminNotificationTemplateListTable({ notificationTemplates }: AdminNotificationTemplateListTableProps) {
  return <DataTable
    items={notificationTemplates ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
  />;
}
