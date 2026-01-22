import { z } from "zod";

import type { User } from "@/features/user/entities";
import {
  createProfileDataValidator,
  getProfilesByCategory,
} from "@/features/core/userProfile/utils";

const nameSchema = z.string();

const emailSchema = z
  .string({ required_error: "メールアドレスを入力してください" })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .email({ message: "メールアドレスの形式が不正です" });

const newPasswordSchema = z
  .string()
  .refine((value) => value.length === 0 || value.length >= 8, {
    message: "パスワードは8文字以上で入力してください",
  });

// profileData バリデーション関数（adminEdit タグでフィルタリング）
const validateProfileData = createProfileDataValidator(getProfilesByCategory("user"), "adminEdit");

export const FormSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    newPassword: newPasswordSchema,
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    validateProfileData(value, ctx);
  });

export type FormValues = {
  name: string;
  email: string;
  newPassword: string;
  role: string;
  profileData?: Record<string, unknown>;
};

export const createDefaultValues = (
  user: User,
  profileData?: Record<string, unknown>,
): FormValues => {
  return {
    name: user.name ?? "",
    email: user.email ?? "",
    role: user.role ?? "user",
    newPassword: "",
    profileData: profileData ?? {},
  };
};
