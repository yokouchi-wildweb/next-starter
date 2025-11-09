// src/features/user/entities/schema.ts

import { USER_PROVIDER_TYPES, USER_ROLES, USER_STATUSES } from "@/constants/user";
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
    .trim()
    .email({ message: "メールアドレスの形式が不正です" })
    .nullish(),
  localPasswordHash: z.string().min(1).nullish(),
  lastAuthenticatedAt: z.coerce.date().nullish(),
});

const displayName = z
  .string()
  .trim()
  .nullish();

/**
 * 一般ユーザー用に利用するスキーマ。
 */
export const GeneralUserSchema = UserCoreSchema.extend({
  displayName: displayName,
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
  displayName: displayName,
});

/**
 * 管理者ユーザー更新用に項目をオプショナルにしたスキーマ。
 */
export const AdminUserOpotionalSchema = AdminUserSchema.partial().extend({
  providerType: UserCoreSchema.shape.providerType,
  providerUid: UserCoreSchema.shape.providerUid,
});
