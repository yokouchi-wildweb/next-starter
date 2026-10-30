// src/features/core/setting/fields/adminListPerPage.ts

import { z } from "zod";

import type { SettingFieldDefinition } from "../types/definition";

export const field = {
  schema: z.coerce.number().int().min(1).max(500).default(100),
  ui: { section: "general", order: 10, field: { label: "一覧表示件数", formInput: "numberInput" } },
} satisfies SettingFieldDefinition;
