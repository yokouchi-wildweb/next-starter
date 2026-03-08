// src/features/chatRoom/hooks/useBulkDeleteByQueryChatRoom.ts

"use client";

import { useBulkDeleteByQueryDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomClient";

export const useBulkDeleteByQueryChatRoom = () => {
  const bulkDeleteByQuery = chatRoomClient.bulkDeleteByQuery;

  if (!bulkDeleteByQuery) {
    throw new Error("ChatRoomの条件指定一括削除機能が利用できません");
  }

  return useBulkDeleteByQueryDomain("chatRooms/bulk-delete-by-query", bulkDeleteByQuery, "chatRooms");
};
