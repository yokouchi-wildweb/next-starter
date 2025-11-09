// src/features/card/components/AdminCardList/Table.tsx

"use client";
import type { CardWithNames } from "@/features/card/entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import { useState } from "react";
import CardDetailModal from "../common/CardDetailModal";
import EditButton from "@/components/Fanctional/EditButton";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import { useDeleteCard } from "@/features/card/hooks/useDeleteCard";

export type AdminCardListTableProps = {
  cards: CardWithNames[];
};

const columns: DataTableColumn<CardWithNames>[] = [
  {
    header: "画像",
    render: (c) =>
      c.mainImageUrl ? <img src={c.mainImageUrl} alt={c.name} className="mx-auto h-12 w-12 object-cover" /> : null,
  },
  {
    header: "タイトル",
    render: (c) => c.titleName,
  },
  {
    header: "カード名",
    render: (c) => c.name,
  },
  {
    header: "型番",
    render: (c) => c.modelNumber ?? "",
  },
  {
    header: "市場価格",
    render: (c) => (c.marketPrice != null ? c.marketPrice.toLocaleString() : ""),
  },
  {
    header: "ポイント価値",
    render: (c) => (c.pointValue != null ? c.pointValue.toLocaleString() : ""),
  },
  {
    header: "タイプ",
    render: (c) => (c.cardType === "real" ? "実在" : "仮想"),
  },
  {
    header: "状態",
    render: (c) => (c.state === "active" ? "有効" : "無効"),
  },
  {
    header: "操作",
    render: (c) => (
      <AdminListActionCell>
        <EditButton href={`/admin/cards/${c.id}/edit`} stopPropagation />
        <span onClick={(e) => e.stopPropagation()}>
          <DeleteButton id={c.id} useDelete={useDeleteCard} title="カード削除" />
        </span>
      </AdminListActionCell>
    ),
  },
];

export default function AdminCardListTable({ cards }: AdminCardListTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <DataTable
        items={cards}
        columns={columns}
        getKey={(c) => c.id}
        rowClassName="cursor-pointer"
        onRowClick={(c) => setSelectedId(c.id)}
      />
      <CardDetailModal cardId={selectedId} open={selectedId !== null} onOpenChange={(o) => !o && setSelectedId(null)} />
    </>
  );
}
