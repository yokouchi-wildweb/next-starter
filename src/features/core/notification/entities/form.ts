// src/features/notification/entities/form.ts

import { z } from "zod";
import { NotificationCreateSchema, NotificationUpdateSchema } from "./schema";

export type NotificationCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type NotificationCreateFields = z.infer<typeof NotificationCreateSchema> & NotificationCreateAdditional;

export type NotificationUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type NotificationUpdateFields = z.infer<typeof NotificationUpdateSchema> & NotificationUpdateAdditional;
