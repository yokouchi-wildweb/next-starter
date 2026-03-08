// src/features/chatRoom/components/AdminChatRoomList/Table.tsx

"use client";

import type { ChatRoom } from "@/features/core/chatRoom/entities";
import { DataTable, TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { EditButton, DeleteButton } from "@/lib/crud";
import { normalizeDomainJsonConfig } from "@/lib/domain/config/normalizeDomainJsonConfig";
import rawConfig from "@/features/core/chatRoom/domain.json";

const config = normalizeDomainJsonConfig(rawConfig);
import presenters from "@/features/core/chatRoom/presenters";
import { useState } from "react";
import ChatRoomDetailModal from "../common/ChatRoomDetailModal";
import { buildDomainColumns } from "@/lib/crud";
import { UI_BEHAVIOR_CONFIG } from "@/config/ui/ui-behavior-config";

export type AdminChatRoomListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  chatRooms?: ChatRoom[];
};

const [{ adminDataTable }] = UI_BEHAVIOR_CONFIG;
const adminDataTableFallback = adminDataTable?.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<ChatRoom>[] = buildDomainColumns<ChatRoom>({
  config,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: ChatRoom) => (
      <TableCellAction>
        <EditButton domain="chatRoom" id={d.id} />
        <DeleteButton domain="chatRoom" id={d.id} />
      </TableCellAction>
    ),
  },
});

export default function AdminChatRoomListTable({ chatRooms }: AdminChatRoomListTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <DataTable
        items={chatRooms ?? []}
        columns={columns}
        getKey={(d) => d.id}
        rowClassName="cursor-pointer"
        onRowClick={(d) => setSelectedId(String(d.id))}
        emptyValueFallback={adminDataTableFallback}
      />
      <ChatRoomDetailModal
        chatRoomId={selectedId}
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
