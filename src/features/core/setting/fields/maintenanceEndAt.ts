// src/features/core/setting/fields/maintenanceEndAt.ts

import { z } from "zod";

import type { SettingFieldDefinition } from "../types/definition";

export const field: SettingFieldDefinition = {
  schema: z.coerce.date().nullable().default(null),
  ui: { section: "maintenance", order: 30, field: { label: "終了日時", formInput: "datetimeInput", placeholder: "未指定なら自動解除しない" } },
};
