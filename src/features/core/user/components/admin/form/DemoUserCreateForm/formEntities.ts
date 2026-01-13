import { z } from "zod";

import { DEMO_USER_DEFAULT_ROLE } from "@/features/core/user/constants/demoUserAdmin";
import { createProfileDataValidator } from "@/features/core/userProfile/utils/profileSchemaHelpers";
import { DEMO_USER_PROFILES } from "../demoUserProfiles";

const displayNameSchema = z.string();

const emailSchema = z
  .string({ required_error: "メールアドレスを入力してください" })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .email({ message: "メールアドレスの形式が不正です" });

const localPasswordSchema = z
  .string({ required_error: "パスワードを入力してください" })
  .min(8, { message: "パスワードは8文字以上で入力してください" });

// profileData バリデーション関数（admin タグでフィルタリング）
const validateProfileData = createProfileDataValidator(DEMO_USER_PROFILES, "admin");

export const FormSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    localPassword: localPasswordSchema,
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    validateProfileData(value, ctx);
  });

export type FormValues = {
  displayName: string;
  email: string;
  localPassword: string;
  role: string;
  profileData?: Record<string, unknown>;
};

export const DefaultValues: FormValues = {
  displayName: "",
  email: "",
  role: DEMO_USER_DEFAULT_ROLE,
  localPassword: "",
  profileData: {},
};
