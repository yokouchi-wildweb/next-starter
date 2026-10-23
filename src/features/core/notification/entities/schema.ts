// src/features/notification/entities/schemaRegistry.ts

import { emptyToNull } from "@/utils/string";
import { requiredDatetime } from "@/lib/crud/utils";
import { storageMediaValueSchema } from "@/lib/storage/schema";
import { z } from "zod";

export const NotificationBaseSchema = z.object({
  notification_template_id: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  title: z.string().trim().nullish()
    .transform((value) => emptyToNull(value)),
  body: z.string().trim().min(1, { message: "本文は必須です。" }),
  image: z.string().trim().nullish()
    .transform((value) => emptyToNull(value))
    .pipe(storageMediaValueSchema.nullish()),
  target_type: z.enum(["all", "role", "individual"]),
  sender_type: z.enum(["admin", "system"]),
  published_at: requiredDatetime,
});

export const NotificationCreateSchema = NotificationBaseSchema;

export const NotificationUpdateSchema = NotificationBaseSchema.partial();
