// src/features/chatRoom/hooks/useRestoreChatRoom.ts

"use client";

import { useRestoreDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomApiClient";

export const useRestoreChatRoom = () => useRestoreDomain("chatRooms/restore", chatRoomClient.restore!, "chatRooms");
