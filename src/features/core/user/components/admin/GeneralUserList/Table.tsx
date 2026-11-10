// src/features/user/components/admin/GeneralUserList/Table.tsx
// 処理は useGeneralUserListTable、列は createGeneralUserListColumns。ここは並べるだけ

"use client";

import { useMemo } from "react";

import { BulkActionItems, DataTable, RecordSelectionTable } from "@/lib/tableSuite";
import Dialog from "@/components/Overlays/Dialog";
import type { User } from "@/features/core/user/entities";
import { adminConfig } from "@/features/admin/config";
import AdminWalletAdjustModal from "@/features/core/wallet/components/AdminWalletAdjustModal";
import AdminUserManageModal from "@/features/core/user/components/admin/AdminUserManageModal";
import { useGeneralUserListTable } from "@/features/core/user/hooks/useGeneralUserListTable";

import { createGeneralUserListColumns } from "./columns";

type Props = {
  users: User[];
  editBasePath: string;
};

const { dataTable } = adminConfig;
const adminDataTableFallback = dataTable.emptyFieldFallback ?? "(未設定)";

export default function GeneralUserListTable({ users, editBasePath }: Props) {
  const table = useGeneralUserListTable();
  const { selection, bulkActions, onBulkDone, adjust, manage, remove, columnOptions } = table;

  const columns = useMemo(
    () => createGeneralUserListColumns({ ...columnOptions, editBasePath }),
    [columnOptions, editBasePath],
  );

  return (
    <>
      {selection.enabled ? (
        <RecordSelectionTable
          items={users}
          columns={columns}
          getKey={(user) => user.id}
          emptyValueFallback={adminDataTableFallback}
          selectionBehavior={selection.behavior}
          bulkActionsAlwaysVisible={selection.bulkActionsAlwaysVisible}
          bulkActions={(selected) => <BulkActionItems items={bulkActions} selection={selected} onDone={onBulkDone} />}
        />
      ) : (
        <DataTable
          items={users}
          columns={columns}
          getKey={(user) => user.id}
          emptyValueFallback={adminDataTableFallback}
        />
      )}
      {table.canAdjustWallet ? (
        <AdminWalletAdjustModal
          open={Boolean(adjust.target)}
          user={adjust.target}
          onClose={adjust.close}
          onSuccess={adjust.onAdjusted}
        />
      ) : null}
      {table.canManage ? (
        <AdminUserManageModal open={Boolean(manage.target)} user={manage.target} onClose={manage.close} />
      ) : (
        <Dialog
          open={Boolean(remove.target)}
          onOpenChange={(open) => !open && remove.cancel()}
          title="ユーザー削除"
          description={`${remove.target?.name ?? remove.target?.email ?? "このユーザー"} を削除します。削除されたユーザーはログインできなくなります。`}
          confirmLabel="削除する"
          cancelLabel="キャンセル"
          onConfirm={remove.confirm}
          confirmDisabled={remove.isDeleting}
          confirmVariant="destructive"
        />
      )}
    </>
  );
}
