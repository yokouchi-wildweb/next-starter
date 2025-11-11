// src/features/setting/entities/schemaRegistry.ts

import { z } from "zod";

export const SettingBaseSchema = z.object({
  developerMotivation: z.coerce.number().int().min(0).max(200),
  adminHeaderLogoImageUrl: z.string().nullish(),
  adminHeaderLogoImageDarkUrl: z.string().nullish(),
  adminListPerPage: z.coerce.number().int().min(1).max(500),
  adminFooterText: z
    .string()
    .min(1, "フッターの文言を入力してください")
    .max(200, "フッターの文言は200文字以内で入力してください"),
});

export const SettingUpdateSchema = SettingBaseSchema;
