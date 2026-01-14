// src/features/user/entities/schema.ts

import { USER_PROVIDER_TYPES, USER_ROLES, USER_STATUSES } from "@/features/core/user/constants";
import { createHashPreservingNullish } from "@/utils/hash";
import { emptyToNull } from "@/utils/string";
import { z } from "zod";

export const UserCoreSchema = z.object({
  providerType: z.enum(USER_PROVIDER_TYPES),
  providerUid: z
    .string({ required_error: "プロバイダー UID が不足しています" })
    .trim()
    .min(1, { message: "プロバイダー UID が不足しています" }),
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES),
  isDemo: z.boolean().default(false),
  email: z
    .string()
    .email()
    .nullish()
    .transform((value) => emptyToNull(value)),
  localPassword: z
    .string()
    .nullish()
    .transform((value) => emptyToNull(value))
    .transform(async (value) => await createHashPreservingNullish(value)),
  lastAuthenticatedAt: z.coerce.date().nullish(),
  deletedAt: z.coerce.date().nullish(),
  displayName: z
    .string()
    .nullish()
    .transform((value) => emptyToNull(value)),
});

/**
 * ユーザー更新用に項目をオプショナルにしたスキーマ。
 * providerType と providerUid は必須のまま維持。
 */
export const UserOptionalSchema = UserCoreSchema.partial().extend({
  providerType: UserCoreSchema.shape.providerType,
  providerUid: UserCoreSchema.shape.providerUid,
});

/**
 * 管理者がユーザー情報を更新する際のスキーマ。
 * 許可するフィールドをホワイトリストで明示的に指定。
 */
export const UserUpdateByAdminSchema = UserOptionalSchema.pick({
  displayName: true,
  email: true,
  localPassword: true,
  status: true,
  role: true,
  isDemo: true,
});

/**
 * 一般ユーザーが自身でプロフィール情報を更新する際のスキーマ。
 * 許可するフィールドをホワイトリストで明示的に指定。
 */
export const UserSelfUpdateSchema = UserOptionalSchema.pick({
  displayName: true,
  email: true,
  localPassword: true,
});

