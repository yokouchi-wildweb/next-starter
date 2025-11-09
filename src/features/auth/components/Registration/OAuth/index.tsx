// src/features/auth/components/Registration/OAuth/index.tsx

"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/Form/button/Button";
import { Form } from "@/components/Shadcn/form";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/controlled";
import { Para } from "@/components/TextBlocks";
import { USER_PROVIDER_TYPES } from "@/constants/user";
import { useRegistration } from "@/features/auth/hooks/useRegistration";
import { err, HttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client/app";
import type { UserProviderType } from "@/types/user";

import { DefaultValues, FormSchema, type FormValues } from "./formEntities";

export function OAuthRegistrationForm() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: DefaultValues,
  });
  const { register, isLoading } = useRegistration();

  const currentUser = auth.currentUser;
  const providerProfile = {
    email: currentUser?.email ?? "",
    displayName: currentUser?.displayName ?? "",
  };
  const isSubmitted = form.formState.isSubmitted;

  useEffect(() => {
    form.setValue("email", providerProfile.email, {
      shouldValidate: isSubmitted,
    });
    form.setValue("displayName", providerProfile.displayName, {
      shouldValidate: isSubmitted,
    });
  }, [form, isSubmitted, providerProfile.displayName, providerProfile.email]);

  const onSubmit = form.handleSubmit(
    useCallback(
      async ({ email, displayName }) => {
        try {
          const currentUser = auth.currentUser;

          if (!currentUser) {
            throw new HttpError({
              message: "認証情報が確認できませんでした。再度OAuth認証からお試しください。",
              status: 401,
            });
          }

          const providerId = currentUser.providerData?.[0]?.providerId ?? null;

          if (!providerId || !USER_PROVIDER_TYPES.includes(providerId as UserProviderType)) {
            throw new HttpError({
              message: "サードパーティの認証情報が確認できませんでした。再度OAuth認証からお試しください。",
              status: 400,
            });
          }

          const idToken = await currentUser.getIdToken();

          await register({
            providerType: providerId as UserProviderType,
            providerUid: currentUser.uid,
            idToken,
            email,
            displayName,
          });

          router.push("/signup/complete");
        } catch (error) {
          const message = err(error, "本登録の処理に失敗しました");
          form.setError("root", { type: "server", message });
        }
      },
      [form, register, router],
    ),
  );

  const rootErrorMessage = form.formState.errors.root?.message ?? null;

  return (
    <Form {...form}>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <FormFieldItem
          control={form.control}
          name="email"
          label={<span className="text-sm font-medium">メールアドレス</span>}
          renderInput={(field) => (
            <TextInput
              field={field}
              required
              type="email"
              placeholder=""
              autoComplete="email"
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

        {rootErrorMessage ? (
          <Para tone="error" size="sm">
            {rootErrorMessage}
          </Para>
        ) : null}

        <Button type="submit" className="w-full justify-center" disabled={isLoading}>
          {isLoading ? "登録処理中..." : "登録を完了"}
        </Button>
      </form>
    </Form>
  );
}

