// src/features/core/setting/entities/form.extended.ts

import type { z } from "zod";
import type { SettingExtendedUpdateSchema } from "./schema.extended";

/** 拡張設定フォームの型定義 */
export type SettingExtendedUpdateFields = z.infer<typeof SettingExtendedUpdateSchema>;
