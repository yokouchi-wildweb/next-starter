// src/domains/chatRoom/services/client/chatRoomClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud";
import type { ChatRoom } from "@/domains/core/chatRoom/entities";
import type {
  ChatRoomCreateFields,
  ChatRoomUpdateFields,
} from "@/domains/core/chatRoom/entities/form";

export const chatRoomClient: ApiClient<
  ChatRoom,
  ChatRoomCreateFields,
  ChatRoomUpdateFields
> = createApiClient<
  ChatRoom,
  ChatRoomCreateFields,
  ChatRoomUpdateFields
>("/api/chatRoom");
