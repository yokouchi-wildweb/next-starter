import { z } from "zod";

import { APP_FEATURES } from "@/config/app/app-features.config";

const { defaultRole } = APP_FEATURES.registration;

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

export const FormSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
  role: z.string(),
  profileData: z.record(z.unknown()).optional(),
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
