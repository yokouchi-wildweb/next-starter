import { z } from "zod";

import { getRolesByCategory } from "@/features/core/user/constants";
import { AdminProfileSchema } from "@/features/core/userProfile/generated/admin";

const displayNameSchema = z.string();

const emailSchema = z
  .string({ required_error: "メールアドレスを入力してください" })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .email({ message: "メールアドレスの形式が不正です" });

const localPasswordSchema = z
  .string({ required_error: "パスワードを入力してください" })
  .min(8, { message: "パスワードは8文字以上で入力してください" });

// admin カテゴリのロールを取得
const adminRoles = getRolesByCategory("admin");
const defaultRole = adminRoles[0] ?? "admin";

export const FormSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  role: z.string(),
  localPassword: localPasswordSchema,
  profileData: AdminProfileSchema,
});

export type FormValues = z.infer<typeof FormSchema>;

export const DefaultValues: FormValues = {
  displayName: "",
  email: "",
  role: defaultRole,
  localPassword: "",
  profileData: {} as z.infer<typeof AdminProfileSchema>,
};
