// src/features/title/components/AdminTitleList/Table.tsx

"use client";

import type { Title } from "@/features/title/entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import EditButton from "@/components/Fanctional/EditButton";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import { useDeleteTitle } from "@/features/title/hooks/useDeleteTitle";
import { formatDateJa } from "@/utils/date";

export type AdminTitleListTableProps = {
  titles: Title[];
};

const columns: DataTableColumn<Title>[] = [
  {
    header: "タイトル名",
    render: (t) => t.name,
  },
  {
    header: "登録日",
    render: (t) => formatDateJa(t.createdAt),
  },
  {
    header: "操作",
    render: (t) => (
      <AdminListActionCell>
        <EditButton href={`/admin/titles/${t.id}/edit`} />
        <DeleteButton id={t.id} useDelete={useDeleteTitle} title="タイトル削除" />
      </AdminListActionCell>
    ),
  },
];

export default function AdminTitleListTable({ titles }: AdminTitleListTableProps) {
  return <DataTable items={titles} columns={columns} getKey={(t) => t.id} />;
}
