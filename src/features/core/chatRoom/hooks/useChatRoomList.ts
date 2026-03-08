// src/features/chatRoom/hooks/useChatRoomList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomClient";
import type { ChatRoom } from "../entities";
import type { SWRConfiguration } from "swr";

export const useChatRoomList = (config?: SWRConfiguration) =>
  useDomainList<ChatRoom>("chatRooms", chatRoomClient.getAll, config);
