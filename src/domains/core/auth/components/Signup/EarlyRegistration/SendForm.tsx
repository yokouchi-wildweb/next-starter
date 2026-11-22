// src/domains/core/auth/components/Signup/EarlyRegistration/SendForm.tsx

"use client";

// 事前登録用メールアドレス入力フォームを提供する Client Component です。
// 入力・送信の処理は useEarlyRegistrationSendForm が持ち、ここは描くだけです。

import { Mail } from "lucide-react";

import { AppForm } from "@/lib/formSuite";
import { Button } from "@/components/Button/Button";
import { ControlledField } from "@/lib/formSuite";
import { ControlledTextInput } from "@/lib/formSuite";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { useEarlyRegistrationSendForm } from "@/domains/core/auth/hooks/useEarlyRegistrationSendForm";

export type EarlyRegistrationSendFormProps = {
  urlAfterEmailSent: string;
};

export function EarlyRegistrationSendForm({
  urlAfterEmailSent,
}: EarlyRegistrationSendFormProps) {
  const { form, onSubmit, isSubmitting, rootErrorMessage } = useEarlyRegistrationSendForm({
    urlAfterEmailSent,
  });

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

          <Button type="submit" disabled={isSubmitting} className="w-full justify-center">
            {isSubmitting ? "送信中..." : "メールアドレスで登録"}
          </Button>
      </AppForm>
    </Block>
  );
}
