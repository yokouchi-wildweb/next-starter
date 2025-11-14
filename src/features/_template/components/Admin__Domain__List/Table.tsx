// src/features/__domain__/components/Admin__Domain__List/Table.tsx

"use client";

import type { __Domain__ } from "../../entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import EditButton from "../../../../components/Fanctional/EditButton";
import DeleteButton from "../../../../components/Fanctional/DeleteButton";
import { useDelete__Domain__ } from "@/features/__domain__/hooks/useDelete__Domain__";
import { truncateJapanese } from "@/utils/string";
import config from "../../domain.json";
import { formatDateJa } from "@/utils/date";

export type Admin__Domain__ListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  __domains__?: __Domain__[];
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

const columns: DataTableColumn<__Domain__>[] = [
  ...tableFields.map((field) => ({
    header: labelMap[field] ?? field,
    render: (d: __Domain__) => {
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
    render: (d: __Domain__) => (
      <AdminListActionCell>
        <EditButton href={`/admin/__domainsSlug__/${d.id}/edit`} />
        <DeleteButton id={d.id} useDelete={useDelete__Domain__} title="__DomainLabel__削除" />
      </AdminListActionCell>
    ),
  },
];

export default function Admin__Domain__ListTable({ __domains__ }: Admin__Domain__ListTableProps) {
  return <DataTable
    items={__domains__ ?? []}
    columns={columns}
    getKey={(d) => d.id}
  />;
}
