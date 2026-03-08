// src/features/notificationTemplate/entities/schemaRegistry.ts

import { z } from "zod";

export const NotificationTemplateBaseSchema = z.object({
  name: z.string().trim().min(1, { message: "管理用名称は必須です。" }),
  title: z.string().trim().min(1, { message: "タイトルは必須です。" }),
  body: z.string().trim().min(1, { message: "本文は必須です。" }),
  variables: z.unknown().nullish(),
  category: z.enum(["system", "manual"]),
});

export const NotificationTemplateCreateSchema = NotificationTemplateBaseSchema;

export const NotificationTemplateUpdateSchema = NotificationTemplateBaseSchema.partial();
