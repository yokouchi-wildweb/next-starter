// src/features/notification/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { requiredDatetime } from "@/lib/crud/utils";
import { z } from "zod";

export const NotificationBaseSchema = z.object({
  notification_template_id: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  title: z.string().trim().min(1, { message: "タイトルは必須です。" }),
  body: z.string().trim().min(1, { message: "本文は必須です。" }),
  target_type: z.enum(["all", "role", "individual"]),
  sender_type: z.enum(["admin", "system"]),
  published_at: requiredDatetime,
});

export const NotificationCreateSchema = NotificationBaseSchema;

export const NotificationUpdateSchema = NotificationBaseSchema.partial();
