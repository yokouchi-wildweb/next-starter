// src/features/cardRarity/components/AdminCardRarityList/Table.tsx

"use client";

import type { CardRarityWithTitle } from "@/features/cardRarity/entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import EditButton from "@/components/Fanctional/EditButton";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import { useDeleteCardRarity } from "@/features/cardRarity/hooks/useDeleteCardRarity";
import { truncateJapanese } from "@/utils/string";
import { formatDateJa } from "@/utils/date";

export type AdminCardRarityListTableProps = {
  rarities: CardRarityWithTitle[];
};

const columns: DataTableColumn<CardRarityWithTitle>[] = [
  { header: "レアリティ名", render: (r) => r.name },
  { header: "タイトル名", render: (r) => r.titleName },
  { header: "並び順", render: (r) => r.sortOrder ?? "" },
  { header: "説明文", render: (r) => truncateJapanese(r.description ?? "", 30) },
  {
    header: "登録日",
    render: (r) => formatDateJa(r.createdAt),
  },
  {
    header: "操作",
    render: (r) => (
      <AdminListActionCell>
        <EditButton href={`/admin/card-rarities/${r.id}/edit`} />
        <DeleteButton id={r.id} useDelete={useDeleteCardRarity} title="レアリティ削除" />
      </AdminListActionCell>
    ),
  },
];

export default function AdminCardRarityListTable({ rarities }: AdminCardRarityListTableProps) {
  return <DataTable items={rarities} columns={columns} getKey={(r) => r.id} />;
}
