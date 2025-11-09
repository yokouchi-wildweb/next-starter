// src/features/bar/components/AdminBarList/Table.tsx

"use client";

import type { Bar } from "../../entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import EditButton from "@/components/Fanctional/EditButton";
import DeleteButton from "@/components/Fanctional/DeleteButton";
import { useDeleteBar } from "@/features/bar/hooks/useDeleteBar";
import { truncateJapanese } from "@/utils/string";
import config from "../../domain.json";

export type AdminBarListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  bars?: Bar[];
};

const tableFields: string[] = Array.isArray(config.tableFields) ? config.tableFields : [];

const labelMap: Record<string, string> = {};
const inputMap: Record<string, string> = {};
(config.fields || []).forEach((f: { name: string; label?: string; formInput?: string }) => {
  labelMap[f.name] = f.label ?? f.name;
  inputMap[f.name] = f.formInput ?? "";
});
(config.relations || []).forEach((r: { fieldName: string; label?: string }) => {
  labelMap[r.fieldName] = r.label ?? r.fieldName;
});

labelMap.id = "ID";
labelMap.createdAt = labelMap.createdAt || "createdAt";
labelMap.updatedAt = labelMap.updatedAt || "updatedAt";

const columns: DataTableColumn<Bar>[] = [
  ...tableFields.map((field) => ({
    header: labelMap[field] ?? field,
    render: (d: Bar) => {
      const value = (d as Record<string, unknown>)[field];
      const input = inputMap[field];
      if (input === "numberInput") {
        return value != null ? Number(value).toLocaleString() : "";
      }
      if (input === "textarea") {
        return truncateJapanese(String(value ?? ""), 30);
      }
      if (input === "imageUploader" || input === "fileUploader") {
        return value ? <img src={String(value)} alt="" className="mx-auto h-12 w-12 object-cover" /> : null;
      }
      return String(value ?? "");
    },
  })),
  {
    header: "操作",
    render: (d: Bar) => (
      <AdminListActionCell>
        <EditButton href={`/admin/bars/${d.id}/edit`} />
        <DeleteButton id={d.id} useDelete={useDeleteBar} title="Bar削除" />
      </AdminListActionCell>
    ),
  },
];

export default function AdminBarListTable({ bars }: AdminBarListTableProps) {
  return <DataTable items={bars ?? []} columns={columns} getKey={(d) => d.id} />;
}
