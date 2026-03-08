// src/features/chatRoom/components/AdminChatRoomList/index.tsx

import type { ChatRoom } from "@/features/core/chatRoom/entities";
import Header from "./Header";
import Table from "./Table";
import { Section } from "@/components/Layout/Section";

export type AdminChatRoomListProps = {
  chatRooms: ChatRoom[];
  page: number;
  perPage: number;
  total: number;
};

export default function AdminChatRoomList({
  chatRooms,
  page,
  perPage,
  total,
}: AdminChatRoomListProps) {
  return (
    <Section>
      <Header page={page} perPage={perPage} total={total} />
      <Table chatRooms={chatRooms} />
    </Section>
  );
}
