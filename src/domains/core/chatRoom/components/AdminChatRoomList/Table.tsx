// src/domains/chatRoom/components/AdminChatRoomList/Table.tsx

"use client";

import type { ChatRoom } from "@/domains/core/chatRoom/entities";
import { DataTable, TableCellAction, type DataTableColumn } from "@/lib/tableSuite";
import { EditButton, DeleteButton } from "@/lib/crud";
import presenters from "@/domains/core/chatRoom/chatRoomPresenters";
import { useState } from "react";
import ChatRoomDetailModal from "../common/ChatRoomDetailModal";
import { buildDomainColumns } from "@/lib/crud";
import { formatDateJa } from "@/utils/date";
import { truncateJapanese } from "@/utils/string";
import { adminConfig } from "@/domains/admin/config";
import { domainDisplay as chatRoomDisplay } from "@/domains/core/chatRoom/entities/display";

export type AdminChatRoomListTableProps = {
  /**
   * Records to display. Optional so the component can render before data loads
   * without throwing errors.
   */
  chatRooms?: ChatRoom[];
};

const { dataTable } = adminConfig;
const adminDataTableFallback = dataTable.emptyFieldFallback ?? "(未設定)";

const columns: DataTableColumn<ChatRoom>[] = buildDomainColumns<ChatRoom>({
  config: chatRoomDisplay,
  formatDate: formatDateJa,
  truncate: truncateJapanese,
  presenters,
  actionColumn: {
    header: "操作",
    render: (d: ChatRoom) => (
      <TableCellAction>
        <EditButton domain={chatRoomDisplay} id={d.id} />
        <DeleteButton domain={chatRoomDisplay} id={d.id} />
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
