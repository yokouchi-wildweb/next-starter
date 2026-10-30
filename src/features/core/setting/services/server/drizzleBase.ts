// src/features/setting/services/server/drizzleBase.ts

import { z } from "zod";

import { settingTable } from "@/features/core/setting/entities/drizzle";
import { createCrudService } from "@/lib/crud/drizzle";
import type { DrizzleCrudServiceOptions } from "@/lib/crud/drizzle/types";

// 行は id だけで作る(値は保存処理 ./save.ts だけが書く)
const SettingRowSchema = z.object({ id: z.string().min(1) });

const baseOptions = {
  idType: "manual",
  // global 設定は 1 リクエスト内で複数サブシステム（メンテ判定・各機能の設定参照等）
  // 繰り返し読まれる高 fan-in 行のため、リクエストスコープでメモ化する。
  requestMemo: true,
  parseCreate: (data) => SettingRowSchema.parse(data),
  parseUpsert: (data) => SettingRowSchema.parse(data),
} satisfies DrizzleCrudServiceOptions<z.infer<typeof SettingRowSchema>>;

export const base = createCrudService(settingTable, baseOptions);
