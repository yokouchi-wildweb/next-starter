// src/features/auth/entities/schema.ts

import { USER_PROVIDER_TYPES } from "@/constants/user";
import { z } from "zod";

import { GeneralUserSchema } from "@/features/user/entities/schema";

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

// 仮登録用のスキーマ
export const PreRegistrationSchema = z.object({
  providerType: z.enum(USER_PROVIDER_TYPES),
  providerUid: ProviderUidSchema,
  email: OptionalEmailSchema,
  idToken: IdTokenSchema,
});

// 本登録用のスキーマ
export const RegistrationSchema = GeneralUserSchema.pick({
  providerType: true,
  providerUid: true,
  email: true,
  displayName: true,
}).extend({
  providerUid: GeneralUserSchema.shape.providerUid,
  email: GeneralUserSchema.shape.email.innerType().unwrap().unwrap(),
  idToken: IdTokenSchema,
  password: PasswordSchema.optional(),
});

