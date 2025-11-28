// src/features/user/components/common/EmailUserProfileForm/formEntities.ts

import { z } from "zod";

import type { User } from "@/features/core/user/entities";

export const FormSchema = z
  .object({
    displayName: z.string().trim().optional(),
    email: z
      .string()
      .trim()
      .min(1, { message: "メールアドレスを入力してください" })
      .email({ message: "メールアドレスの形式が不正です" }),
    localPassword: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (
      values.localPassword &&
      values.localPassword.trim().length > 0 &&
      values.localPassword.trim().length < 8
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "パスワードは8文字以上で入力してください",
        path: ["localPassword"],
      });
    }
  });

export type FormValues = z.infer<typeof FormSchema>;

export function createDefaultValues(user: User): FormValues {
  return {
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    localPassword: "",
  };
}
