// src/features/setting/entities/index.ts

export * from "./model";
export * from "./drizzle";
export * from "./schema";
export * from "./form";

// 拡張エンティティ（setting-fields.json から生成）
export * from "./schema.extended";
export * from "./model.extended";
export * from "./form.extended";

// 統合スキーマ
import { SettingBaseSchema, SettingUpdateSchema } from "./schema";
import { SettingExtendedBaseSchema } from "./schema.extended";

export const SettingCombinedBaseSchema = SettingBaseSchema.merge(SettingExtendedBaseSchema);
export const SettingCombinedUpdateSchema = SettingUpdateSchema.merge(SettingExtendedBaseSchema.partial());
