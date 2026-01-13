// src/features/core/userProfile/utils/profileSchemaHelpers.ts
// プロフィールスキーマのヘルパー関数

import type { z } from "zod";
import { PROFILE_SCHEMA_REGISTRY } from "@/registry/profileSchemaRegistry";

/**
 * ロールに対応するプロフィールスキーマを取得
 */
export function getProfileSchema(role: string): z.ZodType | null {
  return PROFILE_SCHEMA_REGISTRY[role] ?? null;
}

/**
 * スキーマから指定フィールドのみを抽出
 * @param schema - 全フィールドを含むZodスキーマ
 * @param fields - 抽出するフィールド名の配列（profile.json の tags から取得）
 */
export function pickSchemaByTag(
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>,
  fields: string[] | undefined
): z.ZodObject<Record<string, z.ZodTypeAny>> | null {
  if (!fields || fields.length === 0) return null;
  const pickObj = Object.fromEntries(fields.map((f) => [f, true])) as Record<string, true>;
  return schema.pick(pickObj);
}
