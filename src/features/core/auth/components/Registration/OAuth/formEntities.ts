import { z } from "zod";

import { REGISTRATION_DEFAULT_ROLE } from "@/features/core/auth/constants/registration";
import { createProfileDataValidator } from "@/features/core/userProfile/utils/profileSchemaHelpers";
import { REGISTRATION_PROFILES } from "../registrationProfiles";

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

const agreeToTermsSchema = z.literal(true, {
  errorMap: () => ({ message: "利用規約への同意が必要です" }),
});

export const FormSchema = z
  .object({
    email: emailSchema,
    displayName: displayNameSchema,
    role: z.string(),
    profileData: z.record(z.unknown()).optional(),
    agreeToTerms: agreeToTermsSchema,
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
  agreeToTerms: boolean;
};

export const DefaultValues: FormValues = {
  email: "",
  displayName: "",
  role: REGISTRATION_DEFAULT_ROLE,
  profileData: {},
  agreeToTerms: false,
};
