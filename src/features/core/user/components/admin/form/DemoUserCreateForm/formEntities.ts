import { z } from "zod";

import { USER_ROLES } from "@/features/core/user/constants";

const displayNameSchema = z.string();

const emailSchema = z
  .string({ required_error: "メールアドレスを入力してください" })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .email({ message: "メールアドレスの形式が不正です" });

const localPasswordSchema = z.string();

export const FormSchema = z
  .object({
    displayName: displayNameSchema,
    email: emailSchema,
    role: z.enum(USER_ROLES),
    localPassword: localPasswordSchema,
  })
  .refine(
    (data) => {
      // 管理者の場合はパスワード必須（8文字以上）
      if (data.role === "admin") {
        return data.localPassword.length >= 8;
      }
      return true;
    },
    {
      message: "パスワードは8文字以上で入力してください",
      path: ["localPassword"],
    }
  );

export type FormValues = z.infer<typeof FormSchema>;

export const DefaultValues: FormValues = {
  displayName: "",
  email: "",
  role: "user",
  localPassword: "",
};
