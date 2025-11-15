import { z } from "zod";

import { GeneralUserSchema } from "@/features/user/entities";

const emailSchema = z
  .string({
    required_error: "メールアドレスを入力してください",
  })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .pipe(GeneralUserSchema.shape.email.innerType().unwrap().unwrap());

const displayNameSchema = z
  .string({ required_error: "表示名を入力してください" })
  .trim()
  .min(1, { message: "表示名を入力してください" })
  .pipe(GeneralUserSchema.shape.displayName.innerType().unwrap().unwrap());

export const FormSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema,
});

export type FormValues = z.infer<typeof FormSchema>;

export const DefaultValues: FormValues = {
  email: "",
  displayName: "",
};
