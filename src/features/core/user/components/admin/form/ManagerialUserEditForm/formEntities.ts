import { z } from "zod";

import type { User } from "@/features/core/user/entities";
import { getRolesByCategory } from "@/features/core/user/constants/role";

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

// admin カテゴリのロールを取得
const adminRoles = getRolesByCategory("admin");
const defaultRole = adminRoles[0] ?? "admin";

export const FormSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  role: z.string(),
  newPassword: newPasswordSchema,
  profileData: z.record(z.unknown()).optional(),
});

export type FormValues = z.infer<typeof FormSchema>;

export const createDefaultValues = (
  user: User,
  profileData?: Record<string, unknown>,
): FormValues => ({
  displayName: user.displayName ?? "",
  email: user.email ?? "",
  role: user.role ?? defaultRole,
  newPassword: "",
  profileData: profileData ?? {},
});
