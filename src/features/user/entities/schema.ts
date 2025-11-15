// src/features/user/entities/schema.ts

import { USER_PROVIDER_TYPES, USER_ROLES, USER_STATUSES } from "@/constants/user";
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
  displayName: z
    .string()
    .nullish()
    .transform((value) => emptyToNull(value)),
});

export const userMutableSchema = z.object({
  // ダミーフィールド: 自己紹介文。実装時は任意の可変フィールドをここに追加してください。
  introduction: z.string().optional(),
});

/**
 * 一般ユーザー用に利用するスキーマ。
 * 管理者ユーザーと一般ユーザーで可変フィールドの構成を変えたい場合は userMutableSchema を自由に調整してください。
 */
export const GeneralUserSchema = UserCoreSchema.merge(userMutableSchema);

/**
 * 一般ユーザー更新用に項目をオプショナルにしたスキーマ。
 */
export const GeneralUserOptionalSchema = GeneralUserSchema.partial().extend({
  providerType: UserCoreSchema.shape.providerType,
  providerUid: UserCoreSchema.shape.providerUid,
});

export const userSelfUpdateSchema = GeneralUserOptionalSchema.omit({
  providerType: true,
  providerUid: true,
  role: true,
  status: true,
  lastAuthenticatedAt: true,
});


/**
 * 管理者ユーザー用に利用するスキーマ。
 * 管理者ユーザーと一般ユーザーで可変フィールドの構成を変えたい場合は userMutableSchema を自由に調整してください。
 */
export const AdminUserSchema = UserCoreSchema.merge(userMutableSchema);

/**
 * 管理者ユーザー更新用に項目をオプショナルにしたスキーマ。
 */
export const AdminUserOpotionalSchema = AdminUserSchema.partial().extend({
  providerType: UserCoreSchema.shape.providerType,
  providerUid: UserCoreSchema.shape.providerUid,
});
