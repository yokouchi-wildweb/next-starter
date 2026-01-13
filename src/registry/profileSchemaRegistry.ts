// src/registry/profileSchemaRegistry.ts
// プロフィールスキーマのレジストリ（自動生成）
//
// このファイルは role:generate スクリプトによって自動生成されました

import type { z } from "zod";
import { AdminProfileSchema } from "@/features/core/userProfile/generated/admin";
import { ContributorProfileSchema } from "@/features/core/userProfile/generated/contributor";
import { UserProfileSchema } from "@/features/core/userProfile/generated/user";

/**
 * ロール → プロフィールスキーマのマッピング
 */
export const PROFILE_SCHEMA_REGISTRY: Record<string, z.ZodType> = {
  admin: AdminProfileSchema,
  contributor: ContributorProfileSchema,
  user: UserProfileSchema,
};
