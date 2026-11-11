// src/features/core/user/components/admin/GeneralUserList/columns.tsx
// 一般ユーザー一覧の列を組み立てる公開の関数(上流の列 = 並びとセルの中身)。
// 処理(対象の state・削除・機能の開閉)は useGeneralUserListTable が持ち、その columnOptions を広げて渡す。
// fork は戻り値の配列に自分の列を差し込んで使う(README「管理画面の一般ユーザー一覧」)

import { TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { EditButton } from "@/lib/crud/components/Buttons";
import { Button } from "@/components/Form/Button/Button";
import type { User } from "@/features/core/user/entities";
import presenters from "@/features/core/user/presenters";
import { UserAdminMemoCell } from "@/features/core/user/components/common/UserAdminMemoCell";
import { domainDisplay as userDisplay } from "@/features/core/user/entities/display";
import type { GeneralUserListColumnHandlers } from "@/features/core/user/hooks/useGeneralUserListTable";

/**
 * canAdjustWallet: ポイント操作のボタン | canManage: true = 「管理」ボタン、false = 「削除」ボタン |
 * canMemo: メモの列 | isDeleting: 削除ボタンを止めて「削除中...」 | on*: 各ボタンの押下
 * (この部分は useGeneralUserListTable の columnOptions がそのまま持つ)
 */
export type GeneralUserListColumnOptions = GeneralUserListColumnHandlers & {
  /** 編集画面の基点(`${editBasePath}/${id}/edit` へ飛ぶ) */
  editBasePath: string;
};

export function createGeneralUserListColumns({
  editBasePath,
  canAdjustWallet,
  canManage,
  canMemo,
  isDeleting,
  onAdjust,
  onManage,
  onDelete,
}: GeneralUserListColumnOptions): DataTableColumn<User>[] {
  const columns: DataTableColumn<User>[] = [
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
      header: "認証方法",
      render: (user) =>
        presenters.providerType({
          value: user.providerType,
          field: "providerType",
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
  ];

  if (canMemo) {
    columns.push({
      header: "メモ",
      render: (user) => <UserAdminMemoCell userId={user.id} memo={user.adminMemo} />,
    });
  }

  columns.push({
    header: "操作",
    render: (user) => (
      <TableCellAction>
        {canAdjustWallet ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onAdjust(user)}
          >
            ポイント操作
          </Button>
        ) : null}
        {canManage ? (
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
            disabled={isDeleting}
          >
            {isDeleting ? "削除中..." : "削除"}
          </Button>
        )}
        <EditButton domain={userDisplay} id={user.id} href={`${editBasePath}/${user.id}/edit`} />
      </TableCellAction>
    ),
  });

  return columns;
}
