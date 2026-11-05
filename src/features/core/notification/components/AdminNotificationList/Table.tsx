// src/features/notification/components/AdminNotificationList/Table.tsx

"use client";

import { useState, type Key } from "react";

import type { Notification } from "@/features/notification/entities";
import { BulkActionItems, RecordSelectionTable, TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { DeleteButton } from "@/lib/crud/components";
import { useNotificationAdminBulkActions } from "@/features/core/notification/hooks/useNotificationAdminBulkActions";
import presenters from "@/features/notification/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import NotificationDetailModal from "@/features/core/notification/components/common/NotificationDetailModal";
import { domainDisplay as notificationDisplay } from "@/features/core/notification/entities/display";

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
    config: notificationDisplay,
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
        <DeleteButton domain={notificationDisplay} id={d.id} />
      </TableCellAction>
    ),
  };

  return [...baseColumns, readCountColumn, actionColumn];
}

export default function AdminNotificationListTable({ notifications, readCounts = {} }: AdminNotificationListTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // チェックボックスで選択中の行（お知らせID）。バルク削除の対象。
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const columns = buildColumns(readCounts);
  // 一括操作: 受け口 adminBulkActions の項目(上流の既定 = 一括削除 + fork の項目。D149)
  const bulkActionItems = useNotificationAdminBulkActions();

  return (
    <>
      <RecordSelectionTable
        items={notifications ?? []}
        columns={columns}
        getKey={(d) => d.id}
        rowClassName="cursor-pointer"
        // checkbox選択にすることで、行クリックは従来どおり詳細モーダルを開く挙動を維持する
        selectionBehavior="checkbox"
        selectedKeys={selectedKeys}
        onSelectionChange={(keys) => setSelectedKeys(keys)}
        onRowClick={(d) => setSelectedId(String(d.id))}
        emptyValueFallback={adminDataTableFallback}
        bulkActionsAlwaysVisible
        bulkActionsEmptyMessage="お知らせを選択すると一括操作できます"
        bulkActions={(selection) => <BulkActionItems items={bulkActionItems} selection={selection} />}
      />
      <NotificationDetailModal
        notificationId={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
      />
    </>
  );
}
