// src/features/user/components/admin/GeneralUserList/Table.tsx

"use client";

import { useMemo } from "react";
import DataTable, {
  AdminListActionCell,
  type DataTableColumn,
} from "@/components/DataTable";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import EditButton from "@/components/Fanctional/EditButton";
import { useDeleteUser } from "@/features/user/hooks/useDeleteUser";
import type { User } from "@/features/user/entities";
import { formatDateJa } from "@/utils/date";
import type { UserStatus } from "@/types/user";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui-behavior-config";

type Props = {
  users: User[];
  editBasePath: string;
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

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
    header: "ステータス",
    render: (user) => USER_STATUS_LABELS[user.status] ?? user.status,
  },
  {
    header: "表示名",
    render: (user) => user.displayName ?? adminDataTableFallback,
  },
  {
    header: "認証方法",
    render: (user) => user.providerType ?? "-",
  },
  {
    header: "メールアドレス",
    render: (user) => user.email ?? adminDataTableFallback,
  },
  {
    header: "登録日",
    render: (user) => formatDateCell(user.createdAt),
  },
  {
    header: "操作",
    render: (user) => (
      <AdminListActionCell>
        <EditButton href={`${editBasePath}/${user.id}/edit`} />
        <DeleteButton id={user.id} useDelete={useDeleteUser} title="ユーザー削除" />
      </AdminListActionCell>
    ),
  },
];

export default function GeneralUserListTable({ users, editBasePath }: Props) {
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
