// src/domains/core/auth/components/Signup/EmailVarification/sendForm.tsx

"use client";

// メールアドレスを利用したサインアップ手段を提供する Client Component です。
// 入力・送信の処理は useVerificationEmailSendForm が持ち、ここはフォーム部品（lib/formSuite）で描くだけです。

import { Mail } from "lucide-react";

import { AppForm } from "@/lib/formSuite";
import { Button } from "@/components/Button/Button";
import { ControlledField } from "@/lib/formSuite";
import { ControlledTextInput } from "@/lib/formSuite";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { useVerificationEmailSendForm } from "@/domains/core/auth/hooks/useVerificationEmailSendForm";
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
            label={<Span size="sm" weight="medium">メールアドレス</Span>}
            renderInput={(field) => (
              <ControlledTextInput
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
