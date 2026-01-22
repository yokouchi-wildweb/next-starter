// src/features/auth/entities/schema.ts

import { USER_PROVIDER_TYPES } from "@/features/core/user/constants";
import { z } from "zod";

const IdTokenSchema = z
  .string({ required_error: "認証トークンが不足しています" })
  .trim()
  .min(1, { message: "認証トークンが不足しています" });

const PasswordSchema = z
  .string()
  .min(8, { message: "パスワードは8文字以上で入力してください" })
  .max(128, { message: "パスワードは128文字以内で入力してください" });

const ProviderUidSchema = z
  .string({ required_error: "プロバイダー UID が不足しています" })
  .trim()
  .min(1, { message: "プロバイダー UID が不足しています" });

const EmailSchema = z
  .string()
  .trim()
  .email({ message: "メールアドレスの形式が不正です" });

const OptionalEmailSchema = EmailSchema.optional();

const DisplayNameSchema = z
  .string({ required_error: "表示名を入力してください" })
  .trim()
  .min(1, { message: "表示名を入力してください" });

// 仮登録用のスキーマ
export const PreRegistrationSchema = z.object({
  providerType: z.enum(USER_PROVIDER_TYPES),
  providerUid: ProviderUidSchema,
  email: OptionalEmailSchema,
  idToken: IdTokenSchema,
});

// 本登録用のスキーマ
export const RegistrationSchema = z.object({
  providerType: z.enum(USER_PROVIDER_TYPES),
  providerUid: ProviderUidSchema,
  email: EmailSchema,
  name: DisplayNameSchema,
  idToken: IdTokenSchema,
  password: PasswordSchema.optional(),
  /** ロール（指定がない場合は app-features.config の defaultRole を使用） */
  role: z.string().optional(),
  /** ロール別プロフィールデータ（hasProfile: true のロールの場合） */
  profileData: z.record(z.unknown()).optional(),
});

