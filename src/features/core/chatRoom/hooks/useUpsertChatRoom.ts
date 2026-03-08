// src/features/chatRoom/hooks/useUpsertChatRoom.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomClient";
import type { ChatRoom } from "../entities";
import type { ChatRoomCreateFields } from "../entities/form";

export const useUpsertChatRoom = () => {
  const upsert = chatRoomClient.upsert;

  if (!upsert) {
    throw new Error("ChatRoomのアップサート機能が利用できません");
  }

  return useUpsertDomain<ChatRoom, ChatRoomCreateFields>(
    "chatRooms/upsert",
    upsert,
    "chatRooms",
  );
};
