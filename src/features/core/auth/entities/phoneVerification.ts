// src/features/core/auth/entities/phoneVerification.ts

import { z } from "zod";
import { E164_PHONE_REGEX } from "@/features/core/user/utils/phoneNumber";

/**
 * 電話番号チェックリクエストのスキーマ
 */
export const PhoneCheckSchema = z.object({
  phoneNumber: z
    .string({ required_error: "電話番号を入力してください" })
    .regex(E164_PHONE_REGEX, { message: "電話番号はE.164形式で入力してください" }),
});

/**
 * 電話番号検証リクエストのスキーマ
 */
export const PhoneVerificationSchema = z.object({
  phoneNumber: z
    .string({ required_error: "電話番号を入力してください" })
    .regex(E164_PHONE_REGEX, { message: "電話番号はE.164形式で入力してください" }),
  idToken: z
    .string({ required_error: "認証トークンが不足しています" })
    .trim()
    .min(1, { message: "認証トークンが不足しています" }),
});

export type PhoneCheckInput = z.infer<typeof PhoneCheckSchema>;
export type PhoneVerificationInput = z.infer<typeof PhoneVerificationSchema>;
