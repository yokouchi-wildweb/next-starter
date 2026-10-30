// src/features/core/setting/fields/maintenanceStartAt.ts

import { z } from "zod";

import type { SettingFieldDefinition } from "../types/definition";

export const field: SettingFieldDefinition = {
  schema: z.coerce.date().nullable().default(null),
  ui: { section: "maintenance", order: 20, field: { label: "開始日時", formInput: "datetimeInput", placeholder: "未指定なら有効化直後から" } },
};
