// src/domains/core/chatRoom/services/server/chatRoomBase.ts

import { createFirestoreCrudService } from "@/lib/crud/server";
import type { FirestoreCrudServiceOptions } from "@/lib/crud/server";
import type { ChatRoom } from "@/domains/core/chatRoom/entities";
import { ChatRoomCreateSchema, ChatRoomUpdateSchema } from "@/domains/core/chatRoom/entities/schema";

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
} satisfies FirestoreCrudServiceOptions;

// 互換性のためエイリアスもエクスポート
export const chatRoomServiceOptions = baseOptions;

export const chatRoomBase = createFirestoreCrudService<ChatRoom>("chat_rooms", {
  ...baseOptions,
  parseCreate: (data) => ChatRoomCreateSchema.parse(data),
  parseUpdate: (data) => ChatRoomUpdateSchema.parse(data),
  parseUpsert: (data) => ChatRoomCreateSchema.parse(data),
});
