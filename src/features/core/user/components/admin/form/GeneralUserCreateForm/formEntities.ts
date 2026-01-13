import { z } from "zod";

import { getRolesByCategory } from "@/features/core/user/constants";

const displayNameSchema = z.string();

const emailSchema = z
  .string({ required_error: "メールアドレスを入力してください" })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .email({ message: "メールアドレスの形式が不正です" });

const localPasswordSchema = z
  .string({ required_error: "パスワードを入力してください" })
  .min(8, { message: "パスワードは8文字以上で入力してください" });

// user カテゴリのロールを取得
const userRoles = getRolesByCategory("user");
const defaultRole = userRoles[0] ?? "user";

export const FormSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  role: z.string(),
  localPassword: localPasswordSchema,
  profileData: z.record(z.unknown()).optional(),
});

export type FormValues = z.infer<typeof FormSchema>;

export const DefaultValues: FormValues = {
  displayName: "",
  email: "",
  role: defaultRole,
  localPassword: "",
  profileData: {},
};
