// src/features/user/components/common/EmailUserProfileForm/formEntities.ts

import { z } from "zod";

import type { User } from "@/features/user/entities";

export const FormSchema = z
  .object({
    displayName: z.string().trim().optional(),
    email: z
      .string()
      .trim()
      .min(1, { message: "メールアドレスを入力してください" })
      .email({ message: "メールアドレスの形式が不正です" }),
    password: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.password && values.password.trim().length > 0 && values.password.trim().length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "パスワードは8文字以上で入力してください",
        path: ["password"],
      });
    }
  });

export type FormValues = z.infer<typeof FormSchema>;

export function createDefaultValues(user: User): FormValues {
  return {
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    password: "",
  };
}
