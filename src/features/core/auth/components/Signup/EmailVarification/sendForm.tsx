// src/features/core/auth/components/Signup/EmailVarification/sendForm.tsx

"use client";

// メールアドレスを利用したサインアップ手段を提供する Client Component です。
// 入力・送信の処理は useVerificationEmailSendForm が持ち、ここはフォーム部品（components/Form）で描くだけです。

import { Mail } from "lucide-react";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { ControlledField } from "@/components/Form";
import { TextInput } from "@/components/Form/Input/Controlled";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks";
import { useVerificationEmailSendForm } from "@/features/core/auth/hooks/useVerificationEmailSendForm";
import { RecaptchaBadge, RecaptchaV2Challenge } from "@/lib/recaptcha";

export type VerificationEmailSendFormProps = {
  urlAfterEmailSent: string;
};

export function VerificationEmailSendForm({
  urlAfterEmailSent,
}: VerificationEmailSendFormProps) {
  const { form, onSubmit, isSubmitting, rootErrorMessage, recaptchaV2 } =
    useVerificationEmailSendForm({ urlAfterEmailSent });

  return (
    <Block>
      <AppForm
        methods={form}
        onSubmit={onSubmit}
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
            <Para tone="destructive" size="sm">
              {rootErrorMessage}
            </Para>
          ) : null}

          <RecaptchaBadge />

          <Button type="submit" disabled={isSubmitting} className="w-full justify-center">
            {isSubmitting ? "送信中..." : "メールアドレスで登録"}
          </Button>
      </AppForm>

      {/* v2チャレンジモーダル */}
      {recaptchaV2.siteKey && (
        <RecaptchaV2Challenge
          open={recaptchaV2.open}
          onClose={recaptchaV2.onClose}
          onVerify={recaptchaV2.onVerify}
          siteKey={recaptchaV2.siteKey}
        />
      )}
    </Block>
  );
}
