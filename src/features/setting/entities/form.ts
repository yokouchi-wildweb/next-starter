// src/features/setting/entities/form.ts

import { z } from "zod";
import { SettingUpdateSchema } from "./schema";

export type SettingUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type SettingUpdateFields = z.infer<typeof SettingUpdateSchema> & SettingUpdateAdditional;
