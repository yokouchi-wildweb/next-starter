// src/features/notification/components/AdminNotificationList/Table.tsx

"use client";

import { useState, type Key } from "react";

import type { Notification } from "@/features/notification/entities";
import { RecordSelectionTable, TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { DeleteButton, BulkDeleteButton } from "@/lib/crud";
import config from "@/features/notification/domain.json";
import presenters from "@/features/notification/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import NotificationDetailModal from "@/features/core/notification/components/common/NotificationDetailModal";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // チェックボックスで選択中の行（お知らせID）。バルク削除の対象。
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const columns = buildColumns(readCounts);

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
        bulkActionsEmptyMessage="お知らせを選択すると一括削除できます"
        bulkActions={(selection) => (
          <BulkDeleteButton
            domain="notification"
            ids={selection.selectedIds}
            title="お知らせを{count}件削除"
            onSuccess={() => selection.clear()}
          />
        )}
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
