// src/features/user/entities/schema.ts

import { USER_PROVIDER_TYPES, USER_ROLES, USER_STATUSES } from "@/constants/user";
import { createHashPreservingNullish, normalizeEmptyString } from "@/utils/string";
import { z } from "zod";

export const UserCoreSchema = z.object({
  providerType: z.enum(USER_PROVIDER_TYPES),
  providerUid: z
    .string({ required_error: "プロバイダー UID が不足しています" })
    .trim()
    .min(1, { message: "プロバイダー UID が不足しています" }),
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES),
  email: z
    .string()
    .email()
    .nullish()
    .transform((value) => normalizeEmptyString(value)),
  localPassword: z
    .string()
    .nullish()
    .transform((value) => normalizeEmptyString(value))
    .transform(async (value) => await createHashPreservingNullish(value)),
  lastAuthenticatedAt: z.coerce.date().nullish(),
  displayName: z
    .string()
    .nullish()
    .transform((value) => normalizeEmptyString(value)),
});

/**
 * 一般ユーザー用に利用するスキーマ。
 */
export const GeneralUserSchema = UserCoreSchema.extend({
  // ダミーフィールド: z.string()
});

/**
 * 一般ユーザー更新用に項目をオプショナルにしたスキーマ。
 */
export const GeneralUserOptionalSchema = GeneralUserSchema.partial().extend({
  providerType: UserCoreSchema.shape.providerType,
  providerUid: UserCoreSchema.shape.providerUid,
});


/**
 * 管理者ユーザー用に利用するスキーマ。
 */
export const AdminUserSchema = UserCoreSchema.extend({
  // ダミーフィールド: z.string()
});

/**
 * 管理者ユーザー更新用に項目をオプショナルにしたスキーマ。
 */
export const AdminUserOpotionalSchema = AdminUserSchema.partial().extend({
  providerType: UserCoreSchema.shape.providerType,
  providerUid: UserCoreSchema.shape.providerUid,
});
