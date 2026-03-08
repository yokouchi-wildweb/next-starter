// src/features/chatRoom/services/server/firestoreBase.ts

import { createCrudService } from "@/lib/crud/firestore";
import type { CreateCrudServiceOptions } from "@/lib/crud/types";
import type { ChatRoom } from "@/features/core/chatRoom/entities";
import { ChatRoomCreateSchema, ChatRoomUpdateSchema } from "@/features/core/chatRoom/entities/schema";

export const baseOptions = {
  idType: "string",
  useCreatedAt: true,
  useUpdatedAt: true,
  useSoftDelete: true,
  defaultSearchFields: [
    "name"
  ],
  defaultOrderBy: [
    [
      "updatedAt",
      "DESC"
    ]
  ],
} satisfies CreateCrudServiceOptions;

// 互換性のためエイリアスもエクスポート
export const chatRoomServiceOptions = baseOptions;

export const base = createCrudService<ChatRoom>("chat_rooms", {
  ...baseOptions,
  parseCreate: (data) => ChatRoomCreateSchema.parse(data),
  parseUpdate: (data) => ChatRoomUpdateSchema.parse(data),
  parseUpsert: (data) => ChatRoomCreateSchema.parse(data),
});
