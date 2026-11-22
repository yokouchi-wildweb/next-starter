// src/domains/chatRoom/hooks/useHardDeleteChatRoom.ts

"use client";

import { useHardDeleteDomain } from "@/lib/crud";
import { chatRoomClient } from "../services/client/chatRoomClient";

export const useHardDeleteChatRoom = () => useHardDeleteDomain("chatRooms/hard-delete", chatRoomClient.hardDelete!, "chatRooms");
