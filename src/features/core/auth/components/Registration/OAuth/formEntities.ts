import { z } from "zod";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { createProfileDataValidator } from "@/features/core/userProfile/utils/profileSchemaHelpers";
import type { ProfileConfig } from "@/features/core/userProfile/profiles";
import userProfile from "@/features/core/userProfile/profiles/user.profile.json";
import contributorProfile from "@/features/core/userProfile/profiles/contributor.profile.json";

const { defaultRole } = APP_FEATURES.registration;

// 登録画面で使用するプロフィール設定
const REGISTRATION_PROFILES: Record<string, ProfileConfig> = {
  user: userProfile as ProfileConfig,
  contributor: contributorProfile as ProfileConfig,
};

// profileData バリデーション関数
const validateProfileData = createProfileDataValidator(REGISTRATION_PROFILES, "registration");

const emailSchema = z
  .string({
    required_error: "メールアドレスを入力してください",
  })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .email({ message: "メールアドレスの形式が不正です" });

const displayNameSchema = z
  .string({ required_error: "表示名を入力してください" })
  .trim()
  .min(1, { message: "表示名を入力してください" });

export const FormSchema = z
  .object({
    email: emailSchema,
    displayName: displayNameSchema,
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    // profileData バリデーション
    validateProfileData(value, ctx);
  });

export type FormValues = {
  email: string;
  displayName: string;
  role: string;
  profileData?: Record<string, unknown>;
};

export const DefaultValues: FormValues = {
  email: "",
  displayName: "",
  role: defaultRole,
  profileData: {},
};
