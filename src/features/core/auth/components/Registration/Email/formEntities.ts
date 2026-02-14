// src/features/auth/components/Registration/Email/formEntities.ts

import { z } from "zod";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { RegistrationSchema } from "@/features/core/auth/entities";
import { REGISTRATION_DEFAULT_ROLE } from "@/features/core/auth/constants/registration";
import { createProfileDataValidator } from "@/features/core/userProfile/utils";
import { REGISTRATION_PROFILES } from "../registrationProfiles";

// profileData バリデーション関数
const validateProfileData = createProfileDataValidator(REGISTRATION_PROFILES, "registration");

const emailSchema = z
  .string({
    required_error: "メールアドレスを入力してください",
  })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .pipe(RegistrationSchema.shape.email);

const nameSchema = z
  .string({ required_error: "表示名を入力してください" })
  .trim()
  .min(1, { message: "表示名を入力してください" })
  .pipe(RegistrationSchema.shape.name);

const passwordSchema = z
  .string({ required_error: "パスワードは8文字以上で入力してください" })
  .pipe(RegistrationSchema.shape.password.unwrap());

const agreeToTermsSchema = z.boolean().refine((val) => val === true, {
  message: "利用規約への同意が必要です",
});

/** 共通フィールド */
const baseFields = {
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
  role: z.string(),
  profileData: z.record(z.unknown()).optional(),
  inviteCode: z.string().trim().optional(),
  agreeToTerms: agreeToTermsSchema,
};

/** パスワード確認ありスキーマ（double mode） */
const FormSchemaDouble = z
  .object({
    ...baseFields,
    passwordConfirmation: z
      .string({ required_error: "確認用のパスワードを入力してください" })
      .min(1, { message: "確認用のパスワードを入力してください" }),
  })
  .superRefine((value, ctx) => {
    // パスワード確認
    if (value.password !== value.passwordConfirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "パスワードが一致しません",
        path: ["passwordConfirmation"],
      });
    }
    // profileData バリデーション
    validateProfileData(value, ctx);
  });

/** パスワード確認なしスキーマ（single mode） */
const FormSchemaSingle = z
  .object({
    ...baseFields,
  })
  .superRefine((value, ctx) => {
    // profileData バリデーション
    validateProfileData(value, ctx);
  });

export const isDoubleMode = APP_FEATURES.auth.signup.passwordInputMode === "double";

export const FormSchema = isDoubleMode ? FormSchemaDouble : FormSchemaSingle;

export type FormValues = {
  email: string;
  name: string;
  password: string;
  passwordConfirmation?: string;
  role: string;
  profileData?: Record<string, unknown>;
  inviteCode?: string;
  agreeToTerms: boolean;
};

export const DefaultValues: FormValues = {
  email: "",
  name: "",
  password: "",
  role: REGISTRATION_DEFAULT_ROLE,
  profileData: {},
  inviteCode: "",
  agreeToTerms: false,
  ...(isDoubleMode ? { passwordConfirmation: "" } : {}),
};
