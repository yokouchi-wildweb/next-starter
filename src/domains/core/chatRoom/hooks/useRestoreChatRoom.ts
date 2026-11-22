// src/domains/chatRoom/hooks/useRestoreChatRoom.ts

"use client";

import { useRestoreDomain } from "@/lib/crud";
import { chatRoomClient } from "../services/client/chatRoomClient";

export const useRestoreChatRoom = () => useRestoreDomain("chatRooms/restore", chatRoomClient.restore!, "chatRooms");
