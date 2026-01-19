// src/features/user/components/admin/ManagerialUserList/Table.tsx

"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import DataTable, {
  TableCellAction,
  type DataTableColumn,
} from "@/lib/tableSuite/DataTable";
import EditButton from "@/components/Fanctional/EditButton";
import { Button } from "@/components/Form/Button/Button";
import Dialog from "@/components/Overlays/Dialog";
import type { User } from "@/features/core/user/entities";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import presenters from "@/features/core/user/presenters";
import AdminWalletAdjustModal from "@/features/core/wallet/components/AdminWalletAdjustModal";
import AdminUserManageModal from "@/features/core/user/components/admin/AdminUserManageModal";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { useSoftDeleteUser } from "@/features/core/user/hooks/useSoftDeleteUser";
import { useToast } from "@/lib/toast";
import { err } from "@/lib/errors";

type Props = {
  users: User[];
  editBasePath: string;
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const createColumns = (
  editBasePath: string,
  onAdjust: (user: User) => void,
  onManage: (user: User) => void,
  onDelete: (user: User) => void,
  enableWalletAdjust: boolean,
  enableUserManagement: boolean,
  isMutating: boolean,
): DataTableColumn<User>[] => [
  {
    header: "状態",
    render: (user) =>
      presenters.status({
        value: user.status,
        field: "status",
        record: user,
      }),
  },
  {
    header: "ロール",
    render: (user) =>
      presenters.role({
        value: user.role,
        field: "role",
        record: user,
      }),
  },
  {
    header: "表示名",
    render: (user) =>
      presenters.displayName({
        value: user.displayName,
        field: "displayName",
        record: user,
      }),
  },
  {
    header: "メールアドレス",
    render: (user) =>
      presenters.email({
        value: user.email,
        field: "email",
        record: user,
      }),
  },
  {
    header: "最終ログイン",
    render: (user) =>
      presenters.lastAuthenticatedAt({
        value: user.lastAuthenticatedAt,
        field: "lastAuthenticatedAt",
        record: user,
      }),
  },
  {
    header: "操作",
    render: (user) => (
      <TableCellAction>
        {enableWalletAdjust ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onAdjust(user)}
          >
            ポイント操作
          </Button>
        ) : null}
        {enableUserManagement ? (
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={() => onManage(user)}
          >
            管理
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => onDelete(user)}
            disabled={isMutating}
          >
            {isMutating ? "削除中..." : "削除"}
          </Button>
        )}
        <EditButton href={`${editBasePath}/${user.id}/edit`} />
      </TableCellAction>
    ),
  },
];

export default function ManagerialUserListTable({ users, editBasePath }: Props) {
  const [adjustTarget, setAdjustTarget] = useState<User | null>(null);
  const [manageTarget, setManageTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const router = useRouter();
  const { showToast } = useToast();
  const { trigger: triggerDelete, isMutating } = useSoftDeleteUser();

  const enableWalletAdjust = APP_FEATURES.wallet.enableAdminBalanceAdjust;
  const enableUserManagement = APP_FEATURES.adminConsole.enableUserManagement;

  const handleOpenAdjust = useCallback((user: User) => setAdjustTarget(user), []);
  const handleCloseAdjust = useCallback(() => setAdjustTarget(null), []);

  const handleOpenManage = useCallback((user: User) => setManageTarget(user), []);
  const handleCloseManage = useCallback(() => setManageTarget(null), []);

  const handleOpenDelete = useCallback((user: User) => setDeleteTarget(user), []);
  const handleCloseDelete = useCallback(() => setDeleteTarget(null), []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await triggerDelete({ userId: deleteTarget.id });
      showToast("ユーザーを削除しました", "success");
      handleCloseDelete();
      router.refresh();
    } catch (error) {
      showToast(err(error, "ユーザーの削除に失敗しました"), "error");
    }
  }, [deleteTarget, triggerDelete, showToast, handleCloseDelete, router]);

  const columns = useMemo(
    () => createColumns(
      editBasePath,
      handleOpenAdjust,
      handleOpenManage,
      handleOpenDelete,
      enableWalletAdjust,
      enableUserManagement,
      isMutating,
    ),
    [editBasePath, handleOpenAdjust, handleOpenManage, handleOpenDelete, enableWalletAdjust, enableUserManagement, isMutating],
  );

  return (
    <>
      <DataTable
        items={users}
        columns={columns}
        getKey={(user) => user.id}
        emptyValueFallback={adminDataTableFallback}
      />
      {enableWalletAdjust ? (
        <AdminWalletAdjustModal open={Boolean(adjustTarget)} user={adjustTarget} onClose={handleCloseAdjust} />
      ) : null}
      {enableUserManagement ? (
        <AdminUserManageModal open={Boolean(manageTarget)} user={manageTarget} onClose={handleCloseManage} />
      ) : (
        <Dialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && handleCloseDelete()}
          title="ユーザー削除"
          description={`${deleteTarget?.displayName ?? deleteTarget?.email ?? "このユーザー"} を削除します。削除されたユーザーはログインできなくなります。`}
          confirmLabel="削除する"
          cancelLabel="キャンセル"
          onConfirm={handleConfirmDelete}
          confirmDisabled={isMutating}
          confirmVariant="destructive"
        />
      )}
    </>
  );
}
