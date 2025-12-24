// src/features/core/setting/entities/schema.extended.ts
// [GENERATED] このファイルは自動生成されます。直接編集しないでください。
// 生成元: setting-fields.json
// 生成コマンド: pnpm sc:generate

import { z } from "zod";

/**
 * 拡張設定項目のベーススキーマ
 */
export const SettingExtendedBaseSchema = z.object({
  siteTitle: z.string().trim().nullish(),
  maintenanceMode: z.coerce.boolean().nullish(),
  themeColor: z.enum(["blue", "green", "red"]).nullish(),
  ogImageUrl: z.string().trim().nullish(),
});

/**
 * 拡張設定項目の更新スキーマ
 */
export const SettingExtendedUpdateSchema = SettingExtendedBaseSchema.partial();

/**
 * 拡張設定項目の作成スキーマ
 */
export const SettingExtendedCreateSchema = SettingExtendedBaseSchema;
