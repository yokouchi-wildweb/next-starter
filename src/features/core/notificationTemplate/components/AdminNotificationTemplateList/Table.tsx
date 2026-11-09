// src/features/notificationTemplate/components/AdminNotificationTemplateList/Table.tsx

"use client";

import type { NotificationTemplate } from "@/features/core/notificationTemplate/entities";
import { DataTable, TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { EditButton, DeleteButton } from "@/lib/crud/components";
import presenters from "@/features/core/notificationTemplate/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { adminConfig } from "@/features/admin/config";
import { domainDisplay as notificationTemplateDisplay } from "@/features/core/notificationTemplate/entities/display";

export type AdminNotificationTemplateListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  notificationTemplates?: NotificationTemplate[];
};

const { dataTable } = adminConfig;
const adminDataTableFallback = dataTable.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<NotificationTemplate>[] = buildDomainColumns<NotificationTemplate>({
  config: notificationTemplateDisplay,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: NotificationTemplate) => (
      <TableCellAction>
        <EditButton domain={notificationTemplateDisplay} id={d.id} />
        <DeleteButton domain={notificationTemplateDisplay} id={d.id} />
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
