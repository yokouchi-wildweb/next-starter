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
export const extendedKeys = new Set(Object.keys(settingExtendedSchema.shape));

/**
 * フラットなデータを { 基本カラム } と { 拡張フィールド } に分離する
 *
 * クライアントからは { adminListPerPage: 50, siteTitle: "Hello" } のようなフラットデータが送られてくるが、
 * DB上は拡張フィールドを extended jsonb カラムに格納するため、両者を振り分ける。
 * マージ更新（settingService.update）では extended を現在値とマージする必要があるため、
 * pack 前の生の分離結果を再利用できるようこのヘルパを切り出している。
 */
export function splitExtendedFields(data: Record<string, unknown>): {
  base: Record<string, unknown>;
  extended: Record<string, unknown>;
} {
  const base: Record<string, unknown> = {};
  const extended: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (extendedKeys.has(key)) {
      extended[key] = value;
    } else {
      base[key] = value;
    }
  }

  return { base, extended };
}

/**
 * フラットなデータを { 基本カラム, extended: {...} } 形式に変換する
 *
 * 注意: extended は「送られてきたキーだけ」で構築されるフル置換用の形。
 * 部分更新で他フィールドを消さないためのマージは settingService.update 側で行う。
 */
function packExtendedFields(data: Record<string, unknown>): Record<string, unknown> {
  const { base, extended } = splitExtendedFields(data);

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
