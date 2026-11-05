// src/features/core/auth/hooks/useEarlyRegistrationSendForm.ts
//
// 事前登録の送信 form（/entry のメール入力）の公開 hook。useForm・登録済み確認・事前登録リンクの送信・
// メールアドレスの保存・送信後の遷移までを持ち、form を返す。
// 既定の部品 EarlyRegistrationSendForm はこれを呼んで描くだけ。
// 契約（引数・戻り値・form の項目名）→ auth README「公開 hook の契約表」

"use client";

import { useCallback } from "react";
import { useRouter } from "@/lib/unsavedGuard";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/core/auth/constants/localStorage";
import { useEarlyRegistrationEmail } from "@/features/core/auth/hooks/useEarlyRegistrationEmail";
import { useEmailUserExists } from "@/features/core/user/hooks/useEmailUserExists";
import { useLocalStorage } from "@/lib/browserStorage";

import { DefaultValues, FormSchema, type FormValues } from "./signup/emailSendFormEntities";
import { submitEmailSend } from "./signup/sendFlow";

export type UseEarlyRegistrationSendFormParams = {
  /** 送信後の遷移先 */
  urlAfterEmailSent: string;
};

export function useEarlyRegistrationSendForm({ urlAfterEmailSent }: UseEarlyRegistrationSendFormParams) {
  const router = useRouter();
  const { check, isLoading: isChecking } = useEmailUserExists();
  const { sendEarlyRegistrationEmail, isLoading: isSending } = useEarlyRegistrationEmail();
  const [, saveEmail] = useLocalStorage(EMAIL_SIGNUP_STORAGE_KEY, "");
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: DefaultValues,
  });

  const onSubmit = useCallback(
    async ({ email }: FormValues) => {
      form.clearErrors("root");
      const outcome = await submitEmailSend(email, {
        checkExists: check,
        send: (address) => sendEarlyRegistrationEmail(address),
        saveEmail,
        navigate: () => router.push(urlAfterEmailSent),
      });
      if (outcome.kind === "error") {
        form.setError("root", { type: "server", message: outcome.message });
      }
    },
    [form, check, sendEarlyRegistrationEmail, saveEmail, router, urlAfterEmailSent],
  );

  const rootErrorMessage = form.formState.errors.root?.message ?? null;

  return {
    form,
    onSubmit,
    /** 登録済み確認中または送信中 */
    isSubmitting: isChecking || isSending,
    rootErrorMessage,
  } as const;
}
