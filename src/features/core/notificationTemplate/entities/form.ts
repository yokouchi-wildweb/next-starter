// src/features/notificationTemplate/entities/form.ts

import { z } from "zod";
import { NotificationTemplateCreateSchema, NotificationTemplateUpdateSchema } from "./schema";

export type NotificationTemplateCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type NotificationTemplateCreateFields = z.infer<typeof NotificationTemplateCreateSchema> & NotificationTemplateCreateAdditional;

export type NotificationTemplateUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type NotificationTemplateUpdateFields = z.infer<typeof NotificationTemplateUpdateSchema> & NotificationTemplateUpdateAdditional;
