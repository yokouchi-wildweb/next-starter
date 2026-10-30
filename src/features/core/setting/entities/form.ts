// src/features/setting/entities/form.ts

import type { SettingValues } from "./model";

/** 設定の更新で送る値(送ったキーだけ保存される) */
export type SettingUpdateFields = Partial<SettingValues>;
