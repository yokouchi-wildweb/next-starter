import { z } from "zod";

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

const localPasswordSchema = z
  .string({ required_error: "パスワードを入力してください" })
  .min(8, { message: "パスワードは8文字以上で入力してください" });

// profileData バリデーション関数（adminEdit タグでフィルタリング）
const validateProfileData = createProfileDataValidator(getProfilesByCategory("user"), "adminEdit");

export const FormSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    localPassword: localPasswordSchema,
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    validateProfileData(value, ctx);
  });

export type FormValues = {
  name: string;
  email: string;
  localPassword: string;
  role: string;
  profileData?: Record<string, unknown>;
};

export const DefaultValues: FormValues = {
  name: "",
  email: "",
  role: "user",
  localPassword: "",
  profileData: {},
};
