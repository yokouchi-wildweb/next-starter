// src/features/core/user/components/admin/DemoUserList/Table.tsx

"use client";

import { useMemo } from "react";

import DataTable, {
  TableCellAction,
  type DataTableColumn,
} from "@/lib/tableSuite/DataTable";
import HardDeleteButton from "@/components/Fanctional/HardDeleteButton";
import { useHardDeleteUser } from "@/features/core/user/hooks/useHardDeleteUser";
import type { User } from "@/features/core/user/entities";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import presenters from "@/features/core/user/presenters";

type Props = {
  users: User[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const createColumns = (): DataTableColumn<User>[] => {
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
      header: "表示名",
      render: (user) =>
        presenters.displayName({
          value: user.displayName,
          field: "displayName",
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
          <HardDeleteButton id={user.id} useHardDelete={useHardDeleteUser} title="デモユーザー削除" label="削除" description="デモユーザーを削除します。よろしいですか？" confirmLabel="削除する" />
        </TableCellAction>
      ),
    },
  ];
};

export default function DemoUserListTable({ users }: Props) {
  const columns = useMemo(() => createColumns(), []);

  return (
    <DataTable
      items={users}
      columns={columns}
      getKey={(user) => user.id}
      emptyValueFallback={adminDataTableFallback}
    />
  );
}
