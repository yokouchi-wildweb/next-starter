// src/features/core/userProfile/utils/schemaHelpers.ts
// Zodスキーマ操作 + バリデーション関連

import { z } from "zod";
import { PROFILE_SCHEMA_REGISTRY } from "@/registry/profileSchemaRegistry";
import type { ProfileConfig } from "../profiles";

/**
 * ロールに対応するプロフィールスキーマを取得
 */
export function getProfileSchema(role: string): z.ZodType | null {
  return PROFILE_SCHEMA_REGISTRY[role] ?? null;
}

/**
 * スキーマから指定フィールドのみを抽出
 * @param schema - 全フィールドを含むZodスキーマ
 * @param tagFields - 抽出するフィールド名の配列（profile.json の tags から取得）
 */
export function pickSchemaByTag(
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>,
  tagFields: string[] | undefined
): z.ZodObject<Record<string, z.ZodTypeAny>> | null {
  if (!tagFields || tagFields.length === 0) return null;
  const pickObj = Object.fromEntries(tagFields.map((f) => [f, true])) as Record<string, true>;
  return schema.pick(pickObj);
}

/**
 * profileData のロール別・タグ別バリデーション関数を生成
 *
 * @param profiles - ロール別プロフィール設定のマッピング
 * @param tag - バリデーション対象のタグ（例: "registration", "mypage"）
 * @returns superRefine で使用するバリデーション関数
 *
 * @example
 * const PROFILES = { user: userProfile, contributor: contributorProfile };
 * const validateProfileData = createProfileDataValidator(PROFILES, "registration");
 *
 * const FormSchema = z.object({ ... }).superRefine((value, ctx) => {
 *   validateProfileData(value, ctx);
 * });
 */
export function createProfileDataValidator(
  profiles: Record<string, ProfileConfig>,
  tag: string
) {
  return (
    value: { role: string; profileData?: Record<string, unknown> },
    ctx: z.RefinementCtx
  ) => {
    const { role, profileData } = value;
    if (!profileData) return;

    // ロールに対応するプロフィール設定を取得
    const profile = profiles[role];
    if (!profile) return;

    // ロールに対応するスキーマを取得
    const fullSchema = getProfileSchema(role);
    if (!fullSchema) return;

    // タグでフィルタリング
    const tagFields = profile.tags?.[tag];
    const filteredSchema = pickSchemaByTag(
      fullSchema as z.ZodObject<Record<string, z.ZodTypeAny>>,
      tagFields
    );
    if (!filteredSchema) return;

    // バリデーション実行
    const result = filteredSchema.safeParse(profileData);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["profileData", ...issue.path],
          message: issue.message,
        });
      });
    }
  };
}
