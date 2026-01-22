// src/features/core/user/components/admin/DemoUserList/Table.tsx

"use client";

import { useCallback, useMemo, useState } from "react";

import DataTable, {
  TableCellAction,
  type DataTableColumn,
} from "@/lib/tableSuite/DataTable";
import HardDeleteButton from "@/components/Fanctional/HardDeleteButton";
import { Button } from "@/components/Form/Button/Button";
import { useHardDeleteUser } from "@/features/core/user/hooks/useHardDeleteUser";
import type { User } from "@/features/core/user/entities";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import presenters from "@/features/core/user/presenters";
import AdminWalletAdjustModal from "@/features/core/wallet/components/AdminWalletAdjustModal";
import { APP_FEATURES } from "@/config/app/app-features.config";

type Props = {
  users: User[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const createColumns = (
  onAdjust: (user: User) => void,
  enableWalletAdjust: boolean,
): DataTableColumn<User>[] => {
  return [
    {
      header: "ステータス",
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
        presenters.name({
          value: user.name,
          field: "name",
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
      header: "登録日",
      render: (user) =>
        presenters.createdAt({
          value: user.createdAt,
          field: "createdAt",
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
          <HardDeleteButton id={user.id} useHardDelete={useHardDeleteUser} title="デモユーザー削除" label="削除" description="デモユーザーを削除します。よろしいですか？" confirmLabel="削除する" />
        </TableCellAction>
      ),
    },
  ];
};

export default function DemoUserListTable({ users }: Props) {
  const [adjustTarget, setAdjustTarget] = useState<User | null>(null);
  const enableWalletAdjust = APP_FEATURES.wallet.enableAdminBalanceAdjust;

  const handleOpenAdjust = useCallback((user: User) => {
    setAdjustTarget(user);
  }, []);

  const handleCloseAdjust = useCallback(() => {
    setAdjustTarget(null);
  }, []);

  const columns = useMemo(
    () => createColumns(handleOpenAdjust, enableWalletAdjust),
    [handleOpenAdjust, enableWalletAdjust],
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
    </>
  );
}
