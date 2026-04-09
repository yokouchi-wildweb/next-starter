// src/features/notification/components/AdminNotificationList/Table.tsx

"use client";

import type { Notification } from "@/features/notification/entities";
import { DataTable, TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { DeleteButton } from "@/lib/crud";
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
  /** 通知IDごとの既読数 */
  readCounts?: Record<string, number>;
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

function buildColumns(readCounts: Record<string, number>): DataTableColumn<Notification>[] {
  const baseColumns = buildDomainColumns<Notification>({
    config,
    presenters,
  });

  // 既読数カラムを追加
  const readCountColumn: DataTableColumn<Notification> = {
    header: "既読数",
    render: (d: Notification) => {
      const count = readCounts[d.id] ?? 0;
      if (d.target_type === "individual") {
        const targetCount = d.target_user_ids?.length ?? 0;
        return `${count} / ${targetCount}人`;
      }
      return `${count}人`;
    },
  };

  const actionColumn: DataTableColumn<Notification> = {
    header: "操作",
    render: (d: Notification) => (
      <TableCellAction>
        <DeleteButton domain="notification" id={d.id} />
      </TableCellAction>
    ),
  };

  return [...baseColumns, readCountColumn, actionColumn];
}

export default function AdminNotificationListTable({ notifications, readCounts = {} }: AdminNotificationListTableProps) {
  const columns = buildColumns(readCounts);
  return <DataTable
    items={notifications ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
  />;
}
