// src/features/sample/components/AdminSampleList/Table.tsx

"use client";

import type { Sample } from "@/features/sample/entities";
import { useMemo, useState } from "react";
import { BulkActionItems, DataTable, RecordSelectionTable, TableCellAction, selectBulkActions, type DataTableColumn } from "@/lib/tableSuite";
import { adminBulkActions } from "@/features/sample/extensions/adminBulkActions";
import { useAdminBulkActionCan } from "@/features/core/user/hooks/useAdminBulkActionCan";
import { EditButton, DuplicateButton, DeleteButton } from "@/lib/crud/components";
import presenters from "@/features/sample/presenters";
import SampleDetailModal from "../common/SampleDetailModal";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import { domainDisplay as sampleDisplay } from "@/features/sample/entities/display";

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
  config: sampleDisplay,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: Sample) => (
      <TableCellAction>
        <EditButton domain={sampleDisplay} id={d.id} />
        <DuplicateButton domain={sampleDisplay} id={d.id} currentName={d.name} />
        <DeleteButton domain={sampleDisplay} id={d.id} />
      </TableCellAction>
    ),
  },
});

export default function AdminSampleListTable({ samples }: AdminSampleListTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 一括操作: 受け口 adminBulkActions の項目(adminBulkActions/<名前>.tsx。D149)。項目が無ければ素の表
  const can = useAdminBulkActionCan();
  const bulkActionItems = useMemo(() => selectBulkActions(Object.values(adminBulkActions), { can }), [can]);

  return (
    <>
      {bulkActionItems.length === 0 ? (
        <DataTable
          items={samples ?? []}
          columns={columns}
          getKey={(d) => d.id}
          rowClassName="cursor-pointer"
          onRowClick={(d) => setSelectedId(String(d.id))}
          emptyValueFallback={adminDataTableFallback}
        />
      ) : (
        <RecordSelectionTable
          items={samples ?? []}
          columns={columns}
          getKey={(d) => d.id}
          rowClassName="cursor-pointer"
          // 行のクリックは詳細を開くので、選択はチェックボックスだけ
          selectionBehavior="checkbox"
          onRowClick={(d) => setSelectedId(String(d.id))}
          emptyValueFallback={adminDataTableFallback}
          bulkActions={(selection) => <BulkActionItems items={bulkActionItems} selection={selection} />}
        />
      )}
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
