// src/features/chatRoom/hooks/useUpdateChatRoom.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomApiClient";
import type { ChatRoom } from "../entities";
import type { ChatRoomUpdateFields } from "../entities/form";

export const useUpdateChatRoom = () =>
  useUpdateDomain<ChatRoom, ChatRoomUpdateFields>(
    "chatRooms/update",
    chatRoomClient.update,
    "chatRooms",
  );
