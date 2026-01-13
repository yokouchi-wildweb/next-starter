import { z } from "zod";

import type { User } from "@/features/core/user/entities";
import { getRolesByCategory } from "@/features/core/user/constants";
import { UserProfileSchema } from "@/features/core/userProfile/generated/user";
import { ContributorProfileSchema } from "@/features/core/userProfile/generated/contributor";

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

// user カテゴリのロールを取得
const userRoles = getRolesByCategory("user");
const defaultRole = userRoles[0] ?? "user";

// ロール別プロフィールスキーマの discriminatedUnion
const profileDataByRole = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), profileData: UserProfileSchema }),
  z.object({ role: z.literal("contributor"), profileData: ContributorProfileSchema }),
]);

// ベーススキーマ（role と profileData 以外）
const baseSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  newPassword: newPasswordSchema,
});

export const FormSchema = baseSchema.and(profileDataByRole);

export type FormValues = z.infer<typeof FormSchema>;

export const createDefaultValues = (
  user: User,
  profileData?: Record<string, unknown>,
): FormValues => {
  const role = (user.role ?? defaultRole) as "user" | "contributor";

  if (role === "contributor") {
    return {
      displayName: user.displayName ?? "",
      email: user.email ?? "",
      role: "contributor",
      newPassword: "",
      profileData: (profileData ?? {}) as z.infer<typeof ContributorProfileSchema>,
    };
  }

  return {
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    role: "user",
    newPassword: "",
    profileData: (profileData ?? {}) as z.infer<typeof UserProfileSchema>,
  };
};
