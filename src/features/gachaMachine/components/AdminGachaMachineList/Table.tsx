// src/features/gachaMachine/components/AdminGachaMachineList/Table.tsx

"use client";

import type { GachaMachine } from "../../entities";
import DataTable, { AdminListActionCell, DataTableColumn } from "@/components/DataTable";
import EditButton from "../../../../components/Fanctional/EditButton";
import DeleteButton from "../../../../components/Fanctional/DeleteButton";
import { useDeleteGachaMachine } from "@/features/gachaMachine/hooks/useDeleteGachaMachine";
import config from "../../domain.json";
import { useState } from "react";
import GachaMachineDetailModal from "../common/GachaMachineDetailModal";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui-behavior-config";

export type AdminGachaMachineListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  gachaMachines?: GachaMachine[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<GachaMachine>[] = buildDomainColumns<GachaMachine>({
  config,
  actionColumn: {
    header: "操作",
    render: (d: GachaMachine) => (
      <AdminListActionCell>
        <EditButton href={`/admin/gacha-machines/${d.id}/edit`} stopPropagation />
        <span onClick={(e) => e.stopPropagation()}>
          <DeleteButton id={d.id} useDelete={useDeleteGachaMachine} title="ガチャマシン削除" />
        </span>
      </AdminListActionCell>
    ),
  },
});

export default function AdminGachaMachineListTable({ gachaMachines }: AdminGachaMachineListTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <DataTable
        items={gachaMachines ?? []}
        columns={columns}
        getKey={(d) => d.id}
        rowClassName="cursor-pointer"
        onRowClick={(d) => setSelectedId(String(d.id))}
        emptyValueFallback={adminDataTableFallback}
      />
      <GachaMachineDetailModal
        gachaMachineId={selectedId}
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
