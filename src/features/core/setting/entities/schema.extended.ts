// src/features/core/setting/entities/schema.extended.ts

export { settingExtendedSchema as SettingExtendedBaseSchema } from "../setting.extended";

import { settingExtendedSchema } from "../setting.extended";

/** 拡張設定項目の更新スキーマ */
export const SettingExtendedUpdateSchema = settingExtendedSchema.partial();

/** 拡張設定項目の作成スキーマ */
export const SettingExtendedCreateSchema = settingExtendedSchema;
