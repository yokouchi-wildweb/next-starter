// src/features/auth/components/Signup/EmailVarification/sendForm.tsx

"use client";

// メールアドレスを利用したサインアップ手段を提供する Client Component です。
// 入力状態は react-hook-form を利用し、フォーム部品は components/Form から利用します。

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { Mail } from "lucide-react";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { ControlledField } from "@/components/Form";
import { TextInput } from "@/components/Form/Input/Controlled";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks";
import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha/constants";
import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/core/auth/constants/localStorage";
import { useVerificationEmail } from "@/features/core/auth/hooks/useVerificationEmail";
import { useEmailUserExists } from "@/features/core/user/hooks/useEmailUserExists";
import { err } from "@/lib/errors";
import { useLocalStorage } from "@/lib/browserStorage";
import {
  getRecaptchaToken,
  RecaptchaBadge,
  RecaptchaV2Challenge,
  useRecaptchaV2Challenge,
  isV2ChallengeRequired,
} from "@/lib/recaptcha";

import { FormSchema, type FormValues, DefaultValues } from "./formEntities";

export type VerificationEmailSendFormProps = {
  urlAfterEmailSent: string;
};

export function VerificationEmailSendForm({
  urlAfterEmailSent,
}: VerificationEmailSendFormProps) {
  const router = useRouter();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { check } = useEmailUserExists();
  const { sendVerificationEmail } = useVerificationEmail();
  const [, saveEmail] = useLocalStorage(EMAIL_SIGNUP_STORAGE_KEY, "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: DefaultValues,
  });

  // v2チャレンジの状態管理
  const {
    challengeState,
    handleV2ChallengeRequired,
    handleV2Verify,
    closeChallenge,
    hasV2Token,
  } = useRecaptchaV2Challenge();

  // v2認証成功後に自動的に再送信するためのフラグ
  const pendingEmailRef = useRef<string | null>(null);

  // v2認証成功後に自動的に再送信
  useEffect(() => {
    if (hasV2Token && pendingEmailRef.current) {
      const email = pendingEmailRef.current;
      pendingEmailRef.current = null;
      setIsSubmitting(true);
      // v2トークンで再送信
      sendVerificationEmail(email, { recaptchaV2Token: challengeState.v2Token ?? undefined })
        .then(() => {
          router.push(urlAfterEmailSent);
        })
        .catch((error) => {
          const message = err(error, "メール送信に失敗しました");
          form.setError("root", { type: "server", message });
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    }
  }, [hasV2Token, challengeState.v2Token, sendVerificationEmail, router, urlAfterEmailSent, form]);

  const handleSubmit = async ({ email }: FormValues) => {
    form.clearErrors("root");
    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim();
      const { exists } = await check(normalizedEmail);

      if (exists) {
        form.setError("root", {
          type: "server",
          message: "このメールアドレスは既に登録されています",
        });
        return;
      }

      // reCAPTCHA トークンを取得
      const recaptchaToken = await getRecaptchaToken(
        executeRecaptcha,
        RECAPTCHA_ACTIONS.SEND_EMAIL_LINK,
      );

      saveEmail(normalizedEmail);
      await sendVerificationEmail(normalizedEmail, { recaptchaToken });
      router.push(urlAfterEmailSent);
    } catch (error) {
      // v2チャレンジが必要な場合
      if (isV2ChallengeRequired(error)) {
        pendingEmailRef.current = form.getValues("email").trim();
        handleV2ChallengeRequired(error);
        return;
      }
      const message = err(error, "メール送信に失敗しました");
      form.setError("root", { type: "server", message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const rootErrorMessage = form.formState.errors.root?.message ?? null;

  return (
    <Block>
      <AppForm
        methods={form}
        onSubmit={handleSubmit}
        pending={isSubmitting}
        className="flex flex-col gap-4"
        noValidate
      >
          <ControlledField
            control={form.control}
            name="email"
            label={<span className="text-sm font-medium">メールアドレス</span>}
            renderInput={(field) => (
              <TextInput
                field={field}
                type="email"
                required
                autoComplete="email"
                placeholder="example@example.com"
                leftIcon={<Mail className="size-4" />}
              />
            )}
          />

          {/* ルートエラーが存在する場合のみメッセージを表示する */}
          {rootErrorMessage ? (
            <Para tone="error" size="sm">
              {rootErrorMessage}
            </Para>
          ) : null}

          <RecaptchaBadge />

          <Button type="submit" disabled={isSubmitting} className="w-full justify-center">
            {isSubmitting ? "送信中..." : "メールアドレスで登録"}
          </Button>
      </AppForm>

      {/* v2チャレンジモーダル */}
      {challengeState.siteKey && (
        <RecaptchaV2Challenge
          open={challengeState.isOpen}
          onClose={closeChallenge}
          onVerify={handleV2Verify}
          siteKey={challengeState.siteKey}
        />
      )}
    </Block>
  );
}
