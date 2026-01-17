// src/features/auth/components/Signup/EmailVarification/sendForm.tsx

"use client";

// メールアドレスを利用したサインアップ手段を提供する Client Component です。
// 入力状態は react-hook-form を利用し、フォーム部品は components/Form から利用します。

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/Controlled";
import { Block } from "@/components/Layout/Block";
import { Para, SecTitle } from "@/components/TextBlocks";
import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/core/auth/constants/localStorage";
import { useVerificationEmail } from "@/features/core/auth/hooks/useVerificationEmail";
import { useEmailUserExists } from "@/features/core/user/hooks/useEmailUserExists";
import { err } from "@/lib/errors";
import { useLocalStorage } from "@/lib/browserStorage";

import { FormSchema, type FormValues, DefaultValues } from "./formEntities";

export type VerificationEmailSendFormProps = {
  urlAfterEmailSent: string;
};

export function VerificationEmailSendForm({
  urlAfterEmailSent,
}: VerificationEmailSendFormProps) {
  const router = useRouter();
  const { check, isLoading: isChecking } = useEmailUserExists();
  const { sendVerificationEmail, isLoading: isSending } = useVerificationEmail();
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
      await sendVerificationEmail(normalizedEmail);
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
        className="space-y-4"
        noValidate
      >
          <FormFieldItem
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
