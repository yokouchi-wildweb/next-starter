// src/features/auth/components/Registration/Email/index.tsx

"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/button/Button";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { PasswordInput, TextInput } from "@/components/Form/controlled";
import { Input } from "@/components/Form/manual";
import { Para } from "@/components/TextBlocks";
import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/auth/config/authSettings";
import { useRegistration } from "@/features/auth/hooks/useRegistration";
import { useLocalStorage } from "@/lib/localStorage";
import { err, HttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client/app";

import { FormSchema, type FormValues, DefaultValues } from "./formEntities";

export function EmailRegistrationForm() {
  const router = useRouter();
  const [savedEmail] = useLocalStorage(EMAIL_SIGNUP_STORAGE_KEY, "");
  const email = useMemo(() => savedEmail.trim(), [savedEmail]);
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      ...DefaultValues,
      email,
    },
  });
  const { register, isLoading } = useRegistration();

  useEffect(() => {
    form.setValue("email", email, { shouldValidate: form.formState.isSubmitted });
  }, [email, form]);

  const handleSubmit = useCallback(
    async ({ email: emailValue, displayName, password }: FormValues) => {
      try {
        const currentUser = auth.currentUser;

        if (!currentUser) {
          throw new HttpError({
            message: "認証情報が確認できませんでした。再度メール認証からお試しください。",
            status: 401,
          });
        }

        const idToken = await currentUser.getIdToken();

        await register({
          providerType: "email",
          providerUid: currentUser.uid,
          idToken,
          email: emailValue,
          displayName,
          password,
        });
        router.push("/signup/complete");
      } catch (error) {
        const message = err(error, "本登録の処理に失敗しました");
        form.setError("root", { type: "server", message });
      }
    },
    [form, register, router],
  );

  const rootErrorMessage = form.formState.errors.root?.message ?? null;

  return (
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
            <Input
              {...field}
              value={field.value ?? ""}
              readOnly
              type="email"
            />
          )}
        />

        <FormFieldItem
          control={form.control}
          name="displayName"
          label={<span className="text-sm font-medium">表示名</span>}
          renderInput={(field) => (
            <TextInput
              field={field}
              required
              placeholder=""
              autoComplete="name"
            />
          )}
        />

        <FormFieldItem
          control={form.control}
          name="password"
          label={<span className="text-sm font-medium">パスワード</span>}
          renderInput={(field) => (
            <PasswordInput
              field={field}
              required
              placeholder="6文字以上"
              autoComplete="new-password"
            />
          )}
        />

        <FormFieldItem
          control={form.control}
          name="passwordConfirmation"
          label={<span className="text-sm font-medium">パスワード（確認）</span>}
          renderInput={(field) => (
            <PasswordInput
              field={field}
              required
              placeholder="同じパスワードを入力"
              autoComplete="new-password"
            />
          )}
        />

        {rootErrorMessage ? (
          <Para tone="error" size="sm">
            {rootErrorMessage}
          </Para>
        ) : null}

        <Button type="submit" className="w-full justify-center" disabled={isLoading}>
          {isLoading ? "登録処理中..." : "登録を完了"}
        </Button>
    </AppForm>
  );
}
