// src/features/user/components/common/OauthUserProfileForm/formEntities.ts

import { z } from "zod";

import type { User } from "@/features/core/user/entities";

export const FormSchema = z.object({
  displayName: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .min(1, { message: "メールアドレスを入力してください" })
    .email({ message: "メールアドレスの形式が不正です" }),
});

export type FormValues = z.infer<typeof FormSchema>;

export function createDefaultValues(user: User): FormValues {
  return {
    displayName: user.displayName ?? "",
    email: user.email ?? "",
  };
}
