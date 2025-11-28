import { z } from "zod";

export const FormSchema = z.object({
  email: z
    .string({ required_error: "メールアドレスを入力してください" })
    .trim()
    .min(1, { message: "メールアドレスを入力してください" })
    .email({ message: "メールアドレスの形式が正しくありません" }),
});

export type FormValues = z.infer<typeof FormSchema>;

export const DefaultValues: FormValues = {
  email: "",
};
