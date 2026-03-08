// src/features/chatRoom/hooks/useBulkUpdateChatRoom.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomApiClient";
import type { ChatRoom } from "../entities";
import type { ChatRoomUpdateFields } from "../entities/form";

export const useBulkUpdateChatRoom = () => {
  const bulkUpdate = chatRoomClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("ChatRoomの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<ChatRoom, ChatRoomUpdateFields>(
    "chatRooms/bulk-update",
    bulkUpdate,
    "chatRooms",
  );
};
