// src/features/setting/entities/schemaRegistry.ts

import { z } from "zod";

export const SettingBaseSchema = z.object({
  adminListPerPage: z.coerce.number().int().min(1).max(500),
});

export const SettingUpdateSchema = SettingBaseSchema.partial();

export const SettingCreateSchema = SettingBaseSchema.extend({
  id: z.string().min(1),
});

export const SettingUpsertSchema = SettingCreateSchema;
