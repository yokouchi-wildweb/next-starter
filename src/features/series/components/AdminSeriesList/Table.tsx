// src/features/series/components/AdminSeriesList/Table.tsx

"use client";

import type { Series } from "@/features/series/entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import EditButton from "@/components/Fanctional/EditButton";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import { useDeleteSeries } from "@/features/series/hooks/useDeleteSeries";
import { truncateJapanese } from "@/utils/string";

export type AdminSeriesListTableProps = {
  series: Series[];
};

const columns: DataTableColumn<Series>[] = [
  {
    header: "シリーズ名",
    render: (s) => s.name,
  },
  {
    header: "説明文",
    render: (s) => truncateJapanese(s.description ?? "", 30),
  },
  {
    header: "発売日",
    render: (s) => s.releaseDate ?? "",
  },
  {
    header: "操作",
    render: (s) => (
      <AdminListActionCell>
        <EditButton href={`/admin/series/${s.id}/edit`} />
        <DeleteButton id={s.id} useDelete={useDeleteSeries} title="シリーズ削除" />
      </AdminListActionCell>
    ),
  },
];

export default function AdminSeriesListTable({ series }: AdminSeriesListTableProps) {
  return <DataTable items={series} columns={columns} getKey={(s) => s.id} />;
}
