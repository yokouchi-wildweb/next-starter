// src/features/chatRoom/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { z } from "zod";

export const ChatRoomBaseSchema = z.object({
  type: z.string().trim().min(1, { message: "種別は必須です。" }),
  name: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  deletedAt: z.date().nullish(),
});

export const ChatRoomCreateSchema = ChatRoomBaseSchema.omit({ deletedAt: true });

export const ChatRoomUpdateSchema = ChatRoomBaseSchema.partial().omit({ deletedAt: true });
