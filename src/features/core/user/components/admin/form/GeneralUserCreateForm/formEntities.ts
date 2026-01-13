import { z } from "zod";

import { getRolesByCategory } from "@/features/core/user/constants";
import { UserProfileSchema } from "@/features/core/userProfile/generated/user";
import { ContributorProfileSchema } from "@/features/core/userProfile/generated/contributor";

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

// ロール別プロフィールスキーマの discriminatedUnion
const profileDataByRole = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), profileData: UserProfileSchema }),
  z.object({ role: z.literal("contributor"), profileData: ContributorProfileSchema }),
]);

// ベーススキーマ（role と profileData 以外）
const baseSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  localPassword: localPasswordSchema,
});

export const FormSchema = baseSchema.and(profileDataByRole);

export type FormValues = z.infer<typeof FormSchema>;

// デフォルト値（新規作成時は user ロールで開始）
export const DefaultValues: FormValues = {
  displayName: "",
  email: "",
  role: "user",
  localPassword: "",
  profileData: {},
};
