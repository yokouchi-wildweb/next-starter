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

type Props = {
  users: User[];
  editBasePath: string;
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
    header: "ステータス",
    render: (user) => USER_STATUS_LABELS[user.status] ?? user.status,
  },
  {
    header: "表示名",
    render: (user) => user.displayName ?? "(未設定)",
  },
  {
    header: "認証方法",
    render: (user) => user.providerType ?? "-",
  },
  {
    header: "メールアドレス",
    render: (user) => user.email ?? "未設定",
  },
  {
    header: "登録日",
    render: (user) => formatDateOrPlaceholder(user.createdAt, "未登録"),
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

  return <DataTable items={users} columns={columns} getKey={(user) => user.id} />;
}
