// src/features/core/auth/components/Signup/EarlyRegistration/SendForm.tsx

"use client";

// 事前登録用メールアドレス入力フォームを提供する Client Component です。
// 入力・送信の処理は useEarlyRegistrationSendForm が持ち、ここは描くだけです。

import { Mail } from "lucide-react";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { ControlledField } from "@/components/Form";
import { TextInput } from "@/components/Form/Input/Controlled";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks";
import { useEarlyRegistrationSendForm } from "@/features/core/auth/hooks/useEarlyRegistrationSendForm";

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

          <Button type="submit" disabled={isSubmitting} className="w-full justify-center">
            {isSubmitting ? "送信中..." : "メールアドレスで登録"}
          </Button>
      </AppForm>
    </Block>
  );
}
