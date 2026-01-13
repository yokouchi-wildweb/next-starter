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
