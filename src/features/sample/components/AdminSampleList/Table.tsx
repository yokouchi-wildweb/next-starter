// src/features/sample/components/AdminSampleList/Table.tsx

"use client";

import type { Sample } from "../../entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import EditButton from "../../../../components/Fanctional/EditButton";
import DeleteButton from "../../../../components/Fanctional/DeleteButton";
import { useDeleteSample } from "@/features/sample/hooks/useDeleteSample";
import config from "../../domain.json";
import { useState } from "react";
import SampleDetailModal from "../common/SampleDetailModal";
import { buildDomainColumns } from "@/lib/crud";

export type AdminSampleListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  samples?: Sample[];
};

const columns: DataTableColumn<Sample>[] = buildDomainColumns<Sample>({
  config,
  actionColumn: {
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
});

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
