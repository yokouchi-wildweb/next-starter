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
  phoneNumber: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, { message: "電話番号はE.164形式で入力してください" })
    .nullish(),
  phoneVerifiedAt: z.coerce.date().nullish(),
  metadata: z.record(z.unknown()).default({}),
  deletedAt: z.coerce.date().nullish(),
  name: z
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
  name: true,
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
  name: true,
  email: true,
  localPassword: true,
});

/**
 * 本登録時のユーザー有効化スキーマ。
 * pending → active への状態遷移で更新可能なフィールドを定義。
 */
export const UserActivationSchema = z.object({
  role: z.enum(USER_ROLES),
  status: z.literal("active"),
  name: z
    .string()
    .min(1, { message: "表示名を入力してください" })
    .transform((value) => emptyToNull(value)),
  email: z
    .string()
    .email()
    .nullish()
    .transform((value) => emptyToNull(value)),
  lastAuthenticatedAt: z.coerce.date(),
});

/**
 * 仮登録時のユーザー作成スキーマ。
 * 新規作成 or withdrawn → pending への状態遷移で設定するフィールドを定義。
 */
export const UserPreRegistrationSchema = z.object({
  providerType: z.enum(USER_PROVIDER_TYPES),
  providerUid: z
    .string({ required_error: "プロバイダー UID が不足しています" })
    .trim()
    .min(1, { message: "プロバイダー UID が不足しています" }),
  role: z.literal("user"),
  status: z.literal("pending"),
  email: z
    .string()
    .email()
    .nullish()
    .transform((value) => emptyToNull(value)),
  lastAuthenticatedAt: z.coerce.date(),
});

