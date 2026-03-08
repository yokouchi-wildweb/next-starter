// src/features/chatRoom/hooks/useHardDeleteChatRoom.ts

"use client";

import { useHardDeleteDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomClient";

export const useHardDeleteChatRoom = () => useHardDeleteDomain("chatRooms/hard-delete", chatRoomClient.hardDelete!, "chatRooms");
