// src/features/auth/components/Registration/Email/index.tsx

"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { PasswordInput, TextInput } from "@/components/Form/Controlled";
import { Input } from "@/components/Form/Manual";
import { Para } from "@/components/TextBlocks";
import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/core/auth/constants/localStorage";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useRegistration } from "@/features/core/auth/hooks/useRegistration";
import { useLocalStorage } from "@/lib/localStorage";
import { err, HttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client/app";

import { RoleSelector, ProfileFields } from "../common";
import { FormSchema, type FormValues, DefaultValues, isDoubleMode } from "./formEntities";

export function EmailRegistrationForm() {
  const router = useRouter();
  const [savedEmail] = useLocalStorage(EMAIL_SIGNUP_STORAGE_KEY, "");
  // ローカルストレージのメールアドレスを優先（認証時に保存された正しい値）
  const email = useMemo(() => savedEmail.trim(), [savedEmail]);
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      ...DefaultValues,
      email,
    },
  });
  const { register, isLoading } = useRegistration();
  const { refreshSession } = useAuthSession();

  // ロール選択を監視してプロフィールフィールドを動的に更新
  const selectedRole = useWatch({ control: form.control, name: "role" });

  useEffect(() => {
    form.setValue("email", email, { shouldValidate: form.formState.isSubmitted });
  }, [email, form]);

  const handleSubmit = useCallback(
    async ({ email: emailValue, displayName, password, role, profileData }: FormValues) => {
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
          role,
          profileData,
        });
        await refreshSession();
        router.push("/signup/complete");
      } catch (error) {
        const message = err(error, "本登録の処理に失敗しました");
        form.setError("root", { type: "server", message });
      }
    },
    [form, refreshSession, register, router],
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
        <RoleSelector control={form.control} name="role" />

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

        {isDoubleMode && (
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
        )}

        <ProfileFields methods={form} role={selectedRole} />

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
