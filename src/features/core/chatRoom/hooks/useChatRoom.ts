// src/features/chatRoom/hooks/useChatRoom.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomClient";
import type { ChatRoom } from "../entities";

export const useChatRoom = (id?: string | null) =>
  useDomain<ChatRoom | undefined>(
    id ? `chatRoom:${id}` : null,
    () => chatRoomClient.getById(id!) as Promise<ChatRoom>,
  );
