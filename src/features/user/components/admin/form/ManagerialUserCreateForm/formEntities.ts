import { z } from "zod";

const displayNameSchema = z.string();

const emailSchema = z
  .string({ required_error: "メールアドレスを入力してください" })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .email({ message: "メールアドレスの形式が不正です" });

const localPasswordSchema = z
  .string({ required_error: "パスワードを入力してください" })
  .min(8, { message: "パスワードは8文字以上で入力してください" });

export const FormSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  role: z.literal("admin"),
  localPassword: localPasswordSchema,
});

export type FormValues = z.infer<typeof FormSchema>;

export const DefaultValues: FormValues = {
  displayName: "",
  email: "",
  role: "admin",
  localPassword: "",
};
