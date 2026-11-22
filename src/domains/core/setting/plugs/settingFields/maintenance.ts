// src/domains/core/setting/fields/maintenance.ts
// メンテナンスの入切と期間(1 つのキー: 片方だけ変えると意味が壊れる値は部分を持つ 1 つのキーにする)。
// 判定は ../utils/maintenanceWindow.ts の isMaintenanceWindowActive。読み手は settingService.isMaintenanceActive と /maintenance の loader

import { z } from "zod";

import type { SettingFieldDefinition } from "@/domains/core/setting/types/definition";

export const field = {
  schema: z
    .object({
      enabled: z.coerce.boolean().default(false),
      startAt: z.coerce.date().nullable().default(null),
      endAt: z.coerce.date().nullable().default(null),
    })
    .default({}),
  ui: {
    section: "maintenance",
    order: 10,
    parts: {
      enabled: { order: 10, field: { label: "メンテナンスモード", formInput: "switchInput" } },
      startAt: { order: 20, field: { label: "開始日時", formInput: "datetimeInput", placeholder: "未指定なら有効化直後から" } },
      endAt: { order: 30, field: { label: "終了日時", formInput: "datetimeInput", placeholder: "未指定なら自動解除しない" } },
    },
  },
} satisfies SettingFieldDefinition;
