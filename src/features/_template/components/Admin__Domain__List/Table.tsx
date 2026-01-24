// src/features/__domain__/components/Admin__Domain__List/Table.tsx

"use client";

import type { __Domain__ } from "@/features/__domain__/entities";
import DataTable, { TableCellAction, type DataTableColumn } from "@/lib/tableSuite/DataTable";
import { EditButton, DeleteButton } from "@/components/Fanctional";
__DUPLICATE_IMPORT__import { useDelete__Domain__ } from "@/features/__domain__/hooks/useDelete__Domain__";
__DUPLICATE_HOOK_IMPORT__import config from "@/features/__domain__/domain.json";
import presenters from "@/features/__domain__/presenters";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";
import { getAdminPaths } from "@/lib/crud/utils";

export type Admin__Domain__ListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  __domains__?: __Domain__[];
};

const paths = getAdminPaths("__domainsSlug__");
const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<__Domain__>[] = buildDomainColumns<__Domain__>({
  config,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: __Domain__) => (
      <TableCellAction>
        <EditButton href={paths.edit(d.id)} />
        __DUPLICATE_BUTTON__<DeleteButton id={d.id} useDelete={useDelete__Domain__} title="__DomainLabel__削除" />
      </TableCellAction>
    ),
  },
});

export default function Admin__Domain__ListTable({ __domains__ }: Admin__Domain__ListTableProps) {
  return <DataTable
    items={__domains__ ?? []}
    columns={columns}
    getKey={(d) => d.id}
    emptyValueFallback={adminDataTableFallback}
  />;
}
