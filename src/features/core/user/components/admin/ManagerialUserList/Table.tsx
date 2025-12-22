// src/features/user/components/admin/ManagerialUserList/Table.tsx

"use client";

import { useCallback, useMemo, useState } from "react";
import DataTable, {
  TableCellAction,
  type DataTableColumn,
} from "@/lib/tableSuite/DataTable";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import EditButton from "@/components/Fanctional/EditButton";
import { Button } from "@/components/Form/Button/Button";
import type { User } from "@/features/core/user/entities";
import { useDeleteUser } from "@/features/core/user/hooks/useDeleteUser";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import presenters from "@/features/core/user/presenters";
import AdminWalletAdjustModal from "@/features/core/wallet/components/AdminWalletAdjustModal";

type Props = {
  users: User[];
  editBasePath: string;
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const createColumns = (
  editBasePath: string,
  onAdjust: (user: User) => void,
): DataTableColumn<User>[] => [
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
    header: "権限",
    render: (user) =>
      presenters.role({
        value: user.role,
        field: "role",
        record: user,
      }),
  },
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
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onAdjust(user)}
        >
          ポイント操作
        </Button>
        <EditButton href={`${editBasePath}/${user.id}/edit`} />
        <DeleteButton id={user.id} useDelete={useDeleteUser} title="ユーザー削除" />
      </TableCellAction>
    ),
  },
];

export default function ManagerialUserListTable({ users, editBasePath }: Props) {
  const [adjustTarget, setAdjustTarget] = useState<User | null>(null);
  const handleOpenAdjust = useCallback((user: User) => setAdjustTarget(user), []);
  const handleCloseAdjust = useCallback(() => setAdjustTarget(null), []);
  const columns = useMemo(() => createColumns(editBasePath, handleOpenAdjust), [editBasePath, handleOpenAdjust]);

  return (
    <>
      <DataTable
        items={users}
        columns={columns}
        getKey={(user) => user.id}
        emptyValueFallback={adminDataTableFallback}
      />
      <AdminWalletAdjustModal open={Boolean(adjustTarget)} user={adjustTarget} onClose={handleCloseAdjust} />
    </>
  );
}
