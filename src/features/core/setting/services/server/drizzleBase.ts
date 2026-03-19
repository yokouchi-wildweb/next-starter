// src/features/setting/services/server/drizzleBase.ts

import { settingTable } from "@/features/core/setting/entities/drizzle";
import {
  SettingCreateSchema,
  SettingUpsertSchema,
} from "@/features/core/setting/entities/schema";
import { SettingCombinedUpdateSchema } from "@/features/core/setting/entities";
import { settingExtendedSchema } from "../../setting.extended";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";
import type { z } from "zod";

// NOTE: drizzleBase ではスキーマの parse/validation のみに責務を限定すること。
// ドメイン固有のロジック（外部サービス連携や判定処理など）は
// src/features/setting/services/server/wrappers/ 以下にラップを作成して差し替えること。

/** 拡張フィールドのキー一覧 */
const extendedKeys = new Set(Object.keys(settingExtendedSchema.shape));

/**
 * フラットなデータを { 基本カラム, extended: {...} } 形式に変換する
 *
 * クライアントからは { adminListPerPage: 50, siteTitle: "Hello" } のようなフラットデータが送られてくるが、
 * DB上は extended jsonb カラムに格納するため、拡張フィールドを extended にパックする。
 */
function packExtendedFields(data: Record<string, unknown>): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  const extended: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (extendedKeys.has(key)) {
      extended[key] = value;
    } else {
      base[key] = value;
    }
  }

  // 拡張フィールドがある場合のみ extended を設定
  if (Object.keys(extended).length > 0) {
    base.extended = extended;
  }

  return base;
}

const baseOptions = {
  idType: "manual",
  parseCreate: (data) => {
    const parsed = SettingCreateSchema.parse(data);
    return packExtendedFields(parsed as Record<string, unknown>) as typeof parsed;
  },
  parseUpdate: (data) => {
    const parsed = SettingCombinedUpdateSchema.parse(data);
    return packExtendedFields(parsed as Record<string, unknown>) as typeof data;
  },
  parseUpsert: (data) => {
    const parsed = SettingUpsertSchema.parse(data);
    return packExtendedFields(parsed as Record<string, unknown>) as typeof parsed;
  },
} satisfies DrizzleCrudServiceOptions<z.infer<typeof SettingCreateSchema>>;

export const base = createCrudService(settingTable, baseOptions);
