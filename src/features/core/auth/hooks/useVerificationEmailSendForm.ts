// src/features/core/auth/hooks/useVerificationEmailSendForm.ts
//
// メール認証の送信 form（/signup のメール入力）の公開 hook。useForm・登録済み確認・reCAPTCHA v3 / v2 再送・
// メールリンクの送信・メールアドレスの保存・送信後の遷移までを持ち、form を返す。
// 既定の部品 VerificationEmailSendForm はこれを呼んで描くだけ。
// 契約（引数・戻り値・form の項目名）→ auth README「公開 hook の契約表」

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/unsavedGuard";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/core/auth/constants/localStorage";
import { useVerificationEmail } from "@/features/core/auth/hooks/useVerificationEmail";
import { useEmailUserExists } from "@/features/core/user/hooks/useEmailUserExists";
import { useLocalStorage } from "@/lib/browserStorage";
import {
  getRecaptchaToken,
  isV2ChallengeRequired,
  useRecaptcha,
  useRecaptchaV2Challenge,
} from "@/lib/recaptcha";
import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha/constants";

import { DefaultValues, FormSchema, type FormValues } from "./signup/emailSendFormEntities";
import { retryEmailSendWithV2, submitEmailSend, type EmailSendOutcome } from "./signup/sendFlow";

export type EmailSendFormValues = FormValues;

export type UseVerificationEmailSendFormParams = {
  /** 送信後の遷移先 */
  urlAfterEmailSent: string;
};

export function useVerificationEmailSendForm({ urlAfterEmailSent }: UseVerificationEmailSendFormParams) {
  const router = useRouter();
  const { executeRecaptcha } = useRecaptcha();
  const { check } = useEmailUserExists();
  const { sendVerificationEmail } = useVerificationEmail();
  const [, saveEmail] = useLocalStorage(EMAIL_SIGNUP_STORAGE_KEY, "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: DefaultValues,
  });

  // v2チャレンジの状態管理
  const { challengeState, handleV2ChallengeRequired, handleV2Verify, closeChallenge, hasV2Token } =
    useRecaptchaV2Challenge();

  // v2認証成功後に自動的に再送信するためのメールアドレス
  const pendingEmailRef = useRef<string | null>(null);

  const navigate = useCallback(() => router.push(urlAfterEmailSent), [router, urlAfterEmailSent]);

  const applyOutcome = useCallback(
    (outcome: EmailSendOutcome) => {
      if (outcome.kind === "v2Required") {
        pendingEmailRef.current = outcome.pendingEmail;
        handleV2ChallengeRequired(outcome.error as Parameters<typeof handleV2ChallengeRequired>[0]);
        return;
      }
      if (outcome.kind === "error") {
        form.setError("root", { type: "server", message: outcome.message });
      }
    },
    [form, handleV2ChallengeRequired],
  );

  // v2認証成功後に自動的に再送信
  useEffect(() => {
    if (hasV2Token && pendingEmailRef.current) {
      const email = pendingEmailRef.current;
      pendingEmailRef.current = null;
      setIsSubmitting(true);
      void retryEmailSendWithV2(email, challengeState.v2Token ?? undefined, {
        send: sendVerificationEmail,
        navigate,
      })
        .then(applyOutcome)
        .finally(() => {
          setIsSubmitting(false);
        });
    }
  }, [hasV2Token, challengeState.v2Token, sendVerificationEmail, navigate, applyOutcome]);

  const onSubmit = useCallback(
    async ({ email }: FormValues) => {
      form.clearErrors("root");
      setIsSubmitting(true);
      try {
        const outcome = await submitEmailSend(email, {
          checkExists: check,
          getRecaptchaToken: () => getRecaptchaToken(executeRecaptcha, RECAPTCHA_ACTIONS.SEND_EMAIL_LINK),
          send: sendVerificationEmail,
          saveEmail,
          navigate,
          isV2ChallengeRequired,
          getPendingEmail: () => form.getValues("email"),
        });
        applyOutcome(outcome);
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, check, executeRecaptcha, sendVerificationEmail, saveEmail, navigate, applyOutcome],
  );

  const rootErrorMessage = form.formState.errors.root?.message ?? null;

  return {
    form,
    onSubmit,
    isSubmitting,
    rootErrorMessage,
    /** v2 チャレンジのモーダルに渡す値（siteKey が null の間は描かない） */
    recaptchaV2: {
      open: challengeState.isOpen,
      siteKey: challengeState.siteKey,
      onClose: closeChallenge,
      onVerify: handleV2Verify,
    },
  } as const;
}
