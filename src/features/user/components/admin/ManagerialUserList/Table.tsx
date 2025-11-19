// src/features/user/components/admin/ManagerialUserList/Table.tsx

"use client";

import { useMemo } from "react";
import DataTable, {
  TableCellAction,
  type DataTableColumn,
} from "@/components/DataTable";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import EditButton from "@/components/Fanctional/EditButton";
import type { User } from "@/features/user/entities";
import { useDeleteUser } from "@/features/user/hooks/useDeleteUser";
import { formatDateJa } from "@/utils/date";
import type { UserRoleType, UserStatus } from "@/types/user";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui-behavior-config";

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

const USER_STATUS_LABELS: Record<UserStatus, string> = {
  pending: "仮登録",
  active: "有効",
  inactive: "停止中",
  locked: "ロック中",
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
    render: (user) => USER_STATUS_LABELS[user.status] ?? user.status,
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
