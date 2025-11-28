// src/features/setting/services/server/drizzleBase.ts

import { settingTable } from "@/features/core/setting/entities/drizzle";
import {
  SettingCreateSchema,
  SettingUpsertSchema,
  SettingUpdateSchema,
} from "@/features/core/setting/entities/schema";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { z } from "zod";

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/setting/services/server/wrappers/ 以下にラップを作成して差し替えること。

const baseOptions = {
  idType: "manual",
  parseCreate: (data) => SettingCreateSchema.parse(data),
  parseUpdate: (data) => SettingUpdateSchema.parse(data),
  parseUpsert: (data) => SettingUpsertSchema.parse(data),
} satisfies DrizzleCrudServiceOptions<z.infer<typeof SettingCreateSchema>>;

export const base = createCrudService(settingTable, baseOptions);
