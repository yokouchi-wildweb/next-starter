// src/features/auth/components/Registration/Email/formEntities.ts

import { z } from "zod";

import { RegistrationSchema } from "@/features/core/auth/entities";

const emailSchema = z
  .string({
    required_error: "メールアドレスを入力してください",
  })
  .trim()
  .min(1, { message: "メールアドレスを入力してください" })
  .pipe(RegistrationSchema.shape.email);

const displayNameSchema = z
  .string({ required_error: "表示名を入力してください" })
  .trim()
  .min(1, { message: "表示名を入力してください" })
  .pipe(RegistrationSchema.shape.displayName);

const passwordSchema = z
  .string({ required_error: "パスワードは8文字以上で入力してください" })
  .pipe(RegistrationSchema.shape.password.unwrap());

export const FormSchema = z
  .object({
    email: emailSchema,
    displayName: displayNameSchema,
    password: passwordSchema,
    passwordConfirmation: z
      .string({ required_error: "確認用のパスワードを入力してください" })
      .min(1, { message: "確認用のパスワードを入力してください" }),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.passwordConfirmation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "パスワードが一致しません",
        path: ["passwordConfirmation"],
      });
    }
  });

export type FormValues = z.infer<typeof FormSchema>;

export const DefaultValues: FormValues = {
  email: "",
  displayName: "",
  password: "",
  passwordConfirmation: "",
};
