// src/features/core/auth/hooks/signup/emailSendFormEntities.ts
// メール認証の送信・事前登録の送信 form の入力（email 1 項目）。内部ファイル: 公開の入口は hooks/useVerificationEmailSendForm・hooks/useEarlyRegistrationSendForm

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
