// src/features/__domain__/components/Admin__Domain__List/Table.tsx

"use client";

import type { __Domain__ } from "@/features/__domain__/entities";
import { useMemo, useState } from "react";
import { BulkActionItems, DataTable, RecordSelectionTable, TableCellAction, selectBulkActions, type DataTableColumn } from "@/lib/tableSuite";
import { adminBulkActions } from "@/features/__domain__/extensions/adminBulkActions";
import { useAdminBulkActionCan } from "@/features/core/user/hooks/useAdminBulkActionCan";
import { EditButton, DeleteButton } from "@/lib/crud/components";
__DUPLICATE_IMPORT__import presenters from "@/features/__domain__/presenters";
import __Domain__DetailModal from "../common/__Domain__DetailModal";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import { domainDisplay as __domain__Display } from "@/features/__domain__/entities/display";

export type Admin__Domain__ListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  __domains__?: __Domain__[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<__Domain__>[] = buildDomainColumns<__Domain__>({
  config: __domain__Display,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: __Domain__) => (
      <TableCellAction>
        <EditButton domain={__domain__Display} id={d.id} />
        __DUPLICATE_BUTTON__<DeleteButton domain={__domain__Display} id={d.id} />
      </TableCellAction>
    ),
  },
});

export default function Admin__Domain__ListTable({ __domains__ }: Admin__Domain__ListTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 一括操作: 受け口 adminBulkActions の項目(adminBulkActions/<名前>.tsx。D149)。項目が無ければ素の表
  const can = useAdminBulkActionCan();
  const bulkActionItems = useMemo(() => selectBulkActions(Object.values(adminBulkActions), { can }), [can]);

  return (
    <>
      {bulkActionItems.length === 0 ? (
        <DataTable
          items={__domains__ ?? []}
          columns={columns}
          getKey={(d) => d.id}
          rowClassName="cursor-pointer"
          onRowClick={(d) => setSelectedId(String(d.id))}
          emptyValueFallback={adminDataTableFallback}
        />
      ) : (
        <RecordSelectionTable
          items={__domains__ ?? []}
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
      <__Domain__DetailModal
        __domain__Id={selectedId}
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
