// src/features/chatRoom/hooks/useCreateChatRoom.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { chatRoomClient } from "../services/client/chatRoomApiClient";
import type { ChatRoom } from "../entities";
import type { ChatRoomCreateFields } from "../entities/form";

export const useCreateChatRoom = () =>
  useCreateDomain<ChatRoom, ChatRoomCreateFields>("chatRooms/create", chatRoomClient.create, "chatRooms");
