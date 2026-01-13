import { z } from "zod";

import type { User } from "@/features/core/user/entities";
import { GENERAL_USER_DEFAULT_ROLE } from "@/features/core/user/constants/generalUserAdmin";
import { createProfileDataValidator } from "@/features/core/userProfile/utils/profileSchemaHelpers";
import { GENERAL_USER_PROFILES } from "../generalUserProfiles";

const displayNameSchema = z.string();

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

// profileData バリデーション関数（admin タグでフィルタリング）
const validateProfileData = createProfileDataValidator(GENERAL_USER_PROFILES, "admin");

export const FormSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    newPassword: newPasswordSchema,
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    validateProfileData(value, ctx);
  });

export type FormValues = {
  displayName: string;
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
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    role: user.role ?? GENERAL_USER_DEFAULT_ROLE,
    newPassword: "",
    profileData: profileData ?? {},
  };
};
