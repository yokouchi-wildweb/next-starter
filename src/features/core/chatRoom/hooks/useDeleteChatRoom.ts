// src/features/chatRoom/hooks/useDeleteChatRoom.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomClient";

export const useDeleteChatRoom = () => useDeleteDomain("chatRooms/delete", chatRoomClient.delete, "chatRooms");
