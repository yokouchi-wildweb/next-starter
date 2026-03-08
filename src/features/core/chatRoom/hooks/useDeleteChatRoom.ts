// src/features/chatRoom/hooks/useDeleteChatRoom.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomApiClient";

export const useDeleteChatRoom = () => useDeleteDomain("chatRooms/delete", chatRoomClient.delete, "chatRooms");
