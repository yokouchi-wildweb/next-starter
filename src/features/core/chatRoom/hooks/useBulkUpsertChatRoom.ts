// src/features/chatRoom/hooks/useBulkUpsertChatRoom.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomClient";
import type { ChatRoom } from "../entities";
import type { ChatRoomCreateFields } from "../entities/form";

export const useBulkUpsertChatRoom = () => {
  const bulkUpsert = chatRoomClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("ChatRoomの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<ChatRoom, ChatRoomCreateFields>(
    "chatRooms/bulk-upsert",
    bulkUpsert,
    "chatRooms",
  );
};
