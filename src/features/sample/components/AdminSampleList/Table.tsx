// src/features/sample/components/AdminSampleList/Table.tsx

"use client";

import type { Sample } from "../../entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import EditButton from "../../../../components/Fanctional/EditButton";
import DeleteButton from "../../../../components/Fanctional/DeleteButton";
import { useDeleteSample } from "@/features/sample/hooks/useDeleteSample";
import { truncateJapanese } from "@/utils/string";
import config from "../../domain.json";
import { useState } from "react";
import SampleDetailModal from "../common/SampleDetailModal";
import { formatDateJa } from "@/utils/date";

export type AdminSampleListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  samples?: Sample[];
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

const columns: DataTableColumn<Sample>[] = [
  ...tableFields.map((field) => ({
    header: labelMap[field] ?? field,
    render: (d: Sample) => {
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
    render: (d: Sample) => (
      <AdminListActionCell>
        <EditButton href={`/admin/samples/${d.id}/edit`} stopPropagation />
        <span onClick={(e) => e.stopPropagation()}>
          <DeleteButton id={d.id} useDelete={useDeleteSample} title="サンプル削除" />
        </span>
      </AdminListActionCell>
    ),
  },
];

export default function AdminSampleListTable({ samples }: AdminSampleListTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <DataTable
        items={samples ?? []}
        columns={columns}
        getKey={(d) => d.id}
        rowClassName="cursor-pointer"
        onRowClick={(d) => setSelectedId(String(d.id))}
      />
      <SampleDetailModal
        sampleId={selectedId}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
          }
        }}
      />
    </>
  );
}
