// src/features/cardTag/components/AdminCardTagList/Table.tsx

"use client";

import type { CardTag } from "@/features/cardTag/entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import EditButton from "@/components/Fanctional/EditButton";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import { useDeleteCardTag } from "@/features/cardTag/hooks/useDeleteCardTag";
import { truncateJapanese } from "@/utils/string";
import { formatDateJa } from "@/utils/date";

export type AdminCardTagListTableProps = {
  cardTags: CardTag[];
};

const columns: DataTableColumn<CardTag>[] = [
  {
    header: "タグ名",
    render: (t) => t.name,
  },
  {
    header: "説明文",
    render: (t) => truncateJapanese(t.description ?? "", 30),
  },
  {
    header: "登録日",
    render: (t) => formatDateJa(t.createdAt),
  },
  {
    header: "操作",
    render: (t) => (
      <AdminListActionCell>
        <EditButton href={`/admin/card-tags/${t.id}/edit`} />
        <DeleteButton id={t.id} useDelete={useDeleteCardTag} title="カードタグ削除" />
      </AdminListActionCell>
    ),
  },
];

export default function AdminCardTagListTable({ cardTags }: AdminCardTagListTableProps) {
  return <DataTable items={cardTags} columns={columns} getKey={(t) => t.id} />;
}
