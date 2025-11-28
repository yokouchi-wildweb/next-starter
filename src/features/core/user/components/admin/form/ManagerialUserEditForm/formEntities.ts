import { z } from "zod";

import type { User } from "@/features/core/user/entities";
import { USER_STATUSES } from "@/constants/user";

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

export const FormSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  role: z.literal("admin"),
  status: z.enum(USER_STATUSES),
  newPassword: newPasswordSchema,
});

export type FormValues = z.infer<typeof FormSchema>;

export const createDefaultValues = (user: User): FormValues => ({
  displayName: user.displayName ?? "",
  email: user.email ?? "",
  role: "admin",
  status: user.status,
  newPassword: "",
});
