// src/features/user/components/admin/ManagerialUserList/Table.tsx

"use client";

import { useMemo } from "react";
import DataTable, {
  AdminListActionCell,
  type DataTableColumn,
} from "@/components/DataTable";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import EditButton from "@/components/Fanctional/EditButton";
import type { User } from "@/features/user/entities";
import { useDeleteUser } from "@/features/user/hooks/useDeleteUser";
import { formatDateJa } from "@/utils/date";
import type { UserRoleType, UserStatus } from "@/types/user";

type Props = {
  users: User[];
  editBasePath: string;
};

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

const formatDateOrPlaceholder = (date: Date | string | null | undefined, fallback: string) => {
  const formatted = formatDateJa(date);
  return formatted || fallback;
};

const createColumns = (editBasePath: string): DataTableColumn<User>[] => [
  {
    header: "表示名",
    render: (user) => user.displayName ?? "未設定",
  },
  {
    header: "メールアドレス",
    render: (user) => user.email ?? "未設定",
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
    render: (user) => formatDateOrPlaceholder(user.lastAuthenticatedAt, "未ログイン"),
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

export default function ManagerialUserListTable({ users, editBasePath }: Props) {
  const columns = useMemo(() => createColumns(editBasePath), [editBasePath]);

  return <DataTable items={users} columns={columns} getKey={(user) => user.id} />;
}
