// src/features/chatRoom/hooks/useSearchChatRoom.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomClient";
import type { ChatRoom } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type ChatRoomSearchParams = NonNullable<typeof chatRoomClient.search> extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchChatRoom = (params: ChatRoomSearchParams) => {
  const search = chatRoomClient.search;

  if (!search) {
    throw new Error("ChatRoomの検索機能が利用できません");
  }

  return useSearchDomain<ChatRoom, ChatRoomSearchParams>(
    "chatRooms/search",
    search,
    params,
  );
};
