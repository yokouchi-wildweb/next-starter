// src/features/sample/components/AdminSampleList/Table.tsx

"use client";

import type { Sample } from "@/features/sample/entities";
import DataTable, { TableCellAction, type DataTableColumn } from "@/lib/tableSuite/DataTable";
import { EditButton, DeleteButton, DuplicateButton } from "@/components/Fanctional";
import { useDeleteSample } from "@/features/sample/hooks/useDeleteSample";
import { useDuplicateSample } from "@/features/sample/hooks/useDuplicateSample";
import config from "@/features/sample/domain.json";
import presenters from "@/features/sample/presenters";
import { useState } from "react";
import SampleDetailModal from "../common/SampleDetailModal";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";

export type AdminSampleListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  samples?: Sample[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<Sample>[] = buildDomainColumns<Sample>({
  config,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: Sample) => (
      <TableCellAction>
        <EditButton href={`/admin/samples/${d.id}/edit`} />
        <DuplicateButton id={d.id} useDuplicate={useDuplicateSample} />
        <DeleteButton id={d.id} useDelete={useDeleteSample} title="サンプル削除" />
      </TableCellAction>
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
        emptyValueFallback={adminDataTableFallback}
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
