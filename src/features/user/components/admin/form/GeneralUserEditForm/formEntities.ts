import { z } from "zod";

import type { User } from "@/features/user/entities";

const displayNameSchema = z.string();

const emailSchema = z
  .string({ required_error: "メールアドレスを入力してください" })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .email({ message: "メールアドレスの形式が不正です" });

export const FormSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  role: z.literal("user"),
});

export type FormValues = z.infer<typeof FormSchema>;

export const createDefaultValues = (user: User): FormValues => ({
  displayName: user.displayName ?? "",
  email: user.email ?? "",
  role: "user",
});
