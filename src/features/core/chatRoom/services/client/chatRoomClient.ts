// src/features/chatRoom/services/client/chatRoomClient.ts

import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { ChatRoom } from "@/features/core/chatRoom/entities";
import type {
  ChatRoomCreateFields,
  ChatRoomUpdateFields,
} from "@/features/core/chatRoom/entities/form";

export const chatRoomClient: ApiClient<
  ChatRoom,
  ChatRoomCreateFields,
  ChatRoomUpdateFields
> = createApiClient<
  ChatRoom,
  ChatRoomCreateFields,
  ChatRoomUpdateFields
>("/api/chatRoom");
