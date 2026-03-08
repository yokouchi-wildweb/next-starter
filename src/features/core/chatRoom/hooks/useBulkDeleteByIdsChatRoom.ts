// src/features/chatRoom/hooks/useBulkDeleteByIdsChatRoom.ts

"use client";

import { useBulkDeleteByIdsDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomClient";

export const useBulkDeleteByIdsChatRoom = () => {
  const bulkDeleteByIds = chatRoomClient.bulkDeleteByIds;

  if (!bulkDeleteByIds) {
    throw new Error("ChatRoomの一括削除機能が利用できません");
  }

  return useBulkDeleteByIdsDomain("chatRooms/bulk-delete-by-ids", bulkDeleteByIds, "chatRooms");
};
