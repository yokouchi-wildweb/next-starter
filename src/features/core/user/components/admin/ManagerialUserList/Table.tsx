// src/features/user/components/admin/ManagerialUserList/Table.tsx

"use client";

import { useMemo } from "react";
import DataTable, {
  TableCellAction,
  type DataTableColumn,
} from "@/lib/tableSuite/DataTable";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import EditButton from "@/components/Fanctional/EditButton";
import type { User } from "@/features/core/user/entities";
import { useDeleteUser } from "@/features/core/user/hooks/useDeleteUser";
import { formatDateJa } from "@/utils/date";
import type { UserRoleType } from "@/types/user";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui-behavior-config";
import { formatUserStatusLabel } from "@/features/core/user/constants/status";

type Props = {
  users: User[];
  editBasePath: string;
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const USER_ROLE_LABELS: Record<UserRoleType, string> = {
  admin: "管理者",
  user: "一般",
};

const formatDateCell = (date: Date | string | null | undefined) => {
  const formatted = formatDateJa(date, { fallback: null });
  return formatted;
};

const createColumns = (editBasePath: string): DataTableColumn<User>[] => [
  {
    header: "表示名",
    render: (user) => user.displayName ?? adminDataTableFallback,
  },
  {
    header: "メールアドレス",
    render: (user) => user.email ?? adminDataTableFallback,
  },
  {
    header: "権限",
    render: (user) => USER_ROLE_LABELS[user.role] ?? user.role,
  },
  {
    header: "状態",
    render: (user) => formatUserStatusLabel(user.status, user.status),
  },
  {
    header: "最終ログイン",
    render: (user) => formatDateCell(user.lastAuthenticatedAt),
  },
  {
    header: "操作",
    render: (user) => (
      <TableCellAction>
        <EditButton href={`${editBasePath}/${user.id}/edit`} />
        <DeleteButton id={user.id} useDelete={useDeleteUser} title="ユーザー削除" />
      </TableCellAction>
    ),
  },
];

export default function ManagerialUserListTable({ users, editBasePath }: Props) {
  const columns = useMemo(() => createColumns(editBasePath), [editBasePath]);

  return (
    <DataTable
      items={users}
      columns={columns}
      getKey={(user) => user.id}
      emptyValueFallback={adminDataTableFallback}
    />
  );
}
