// src/features/chatRoom/entities/form.ts

import { z } from "zod";
import { ChatRoomCreateSchema, ChatRoomUpdateSchema } from "./schema";

export type ChatRoomCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type ChatRoomCreateFields = z.infer<typeof ChatRoomCreateSchema> & ChatRoomCreateAdditional;

export type ChatRoomUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type ChatRoomUpdateFields = z.infer<typeof ChatRoomUpdateSchema> & ChatRoomUpdateAdditional;
