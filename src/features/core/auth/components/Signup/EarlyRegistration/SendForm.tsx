// src/features/core/auth/components/Signup/EarlyRegistration/SendForm.tsx

"use client";

// 事前登録用メールアドレス入力フォームを提供する Client Component です。

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { ControlledField } from "@/components/Form";
import { TextInput } from "@/components/Form/Input/Controlled";
import { Block } from "@/components/Layout/Block";
import { Para } from "@/components/TextBlocks";
import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/core/auth/constants/localStorage";
import { useEarlyRegistrationEmail } from "@/features/core/auth/hooks/useEarlyRegistrationEmail";
import { useEmailUserExists } from "@/features/core/user/hooks/useEmailUserExists";
import { err } from "@/lib/errors";
import { useLocalStorage } from "@/lib/browserStorage";

import { FormSchema, type FormValues, DefaultValues } from "../EmailVarification/formEntities";

export type EarlyRegistrationSendFormProps = {
  urlAfterEmailSent: string;
};

export function EarlyRegistrationSendForm({
  urlAfterEmailSent,
}: EarlyRegistrationSendFormProps) {
  const router = useRouter();
  const { check, isLoading: isChecking } = useEmailUserExists();
  const { sendEarlyRegistrationEmail, isLoading: isSending } = useEarlyRegistrationEmail();
  const [, saveEmail] = useLocalStorage(EMAIL_SIGNUP_STORAGE_KEY, "");
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: DefaultValues,
  });

  const handleSubmit = async ({ email }: FormValues) => {
    form.clearErrors("root");

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

      saveEmail(normalizedEmail);
      await sendEarlyRegistrationEmail(normalizedEmail);
      router.push(urlAfterEmailSent);
    } catch (error) {
      const message = err(error, "メール送信に失敗しました");
      form.setError("root", { type: "server", message });
    }
  };

  const rootErrorMessage = form.formState.errors.root?.message ?? null;
  const isLoading = isChecking || isSending;

  return (
    <Block>
      <AppForm
        methods={form}
        onSubmit={handleSubmit}
        pending={isLoading}
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

          <Button type="submit" disabled={isLoading} className="w-full justify-center">
            {isLoading ? "送信中..." : "メールアドレスで登録"}
          </Button>
      </AppForm>
    </Block>
  );
}
