import { z } from "zod";

const emailSchema = z
  .string({
    required_error: "メールアドレスを入力してください",
  })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .email({ message: "メールアドレスの形式が不正です" });

const displayNameSchema = z
  .string({ required_error: "表示名を入力してください" })
  .trim()
  .min(1, { message: "表示名を入力してください" });

export const FormSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
});

export type FormValues = z.infer<typeof FormSchema>;

export const DefaultValues: FormValues = {
  email: "",
  displayName: "",
};
