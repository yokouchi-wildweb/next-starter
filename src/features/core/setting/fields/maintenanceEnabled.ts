// src/features/core/setting/fields/maintenanceEnabled.ts

import { z } from "zod";

import type { SettingFieldDefinition } from "../types/definition";

export const field: SettingFieldDefinition = {
  schema: z.coerce.boolean().default(false),
  ui: { section: "maintenance", order: 10, field: { label: "メンテナンスモード", formInput: "switchInput" } },
};
