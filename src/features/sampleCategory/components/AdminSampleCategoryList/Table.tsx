// src/features/sampleCategory/components/AdminSampleCategoryList/Table.tsx

"use client";

import type { SampleCategory } from "../../entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import EditButton from "../../../../components/Fanctional/EditButton";
import DeleteButton from "../../../../components/Fanctional/DeleteButton";
import { useDeleteSampleCategory } from "@/features/sampleCategory/hooks/useDeleteSampleCategory";
import { truncateJapanese } from "@/utils/string";
import config from "../../domain.json";
import { formatDateJa } from "@/utils/date";

export type AdminSampleCategoryListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  sampleCategories?: SampleCategory[];
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
labelMap.createdAt = labelMap.createdAt || "作成日時";
labelMap.updatedAt = labelMap.updatedAt || "更新日時";

const columns: DataTableColumn<SampleCategory>[] = [
  ...tableFields.map((field) => ({
    header: labelMap[field] ?? field,
    render: (d: SampleCategory) => {
      const value = (d as Record<string, unknown>)[field];
      const input = inputMap[field];
      const isDateField = value instanceof Date || field === "createdAt" || field === "updatedAt";
      if (isDateField) {
        return formatDateJa(value, { format: "YYYY/MM/DD HH:mm" });
      }
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
    render: (d: SampleCategory) => (
      <AdminListActionCell>
        <EditButton href={`/admin/sample-categories/${d.id}/edit`} />
        <DeleteButton id={d.id} useDelete={useDeleteSampleCategory} title="サンプルカテゴリ削除" />
      </AdminListActionCell>
    ),
  },
];

export default function AdminSampleCategoryListTable({ sampleCategories }: AdminSampleCategoryListTableProps) {
  return <DataTable
    items={sampleCategories ?? []}
    columns={columns}
    getKey={(d) => d.id}
  />;
}
