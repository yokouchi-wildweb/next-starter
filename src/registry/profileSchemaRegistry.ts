// src/registry/profileSchemaRegistry.ts
// プロフィールスキーマのレジストリ（自動生成）
//
// このファイルは role:generate スクリプトによって自動生成されました

import type { z } from "zod";
import { ContributorProfileSchema } from "@/features/core/userProfile/generated/contributor";

/**
 * ロール → プロフィールスキーマのマッピング
 */
export const PROFILE_SCHEMA_REGISTRY: Record<string, z.ZodType> = {
  contributor: ContributorProfileSchema,
};
