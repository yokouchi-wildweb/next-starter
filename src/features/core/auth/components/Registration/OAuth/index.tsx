// src/features/auth/components/Registration/OAuth/index.tsx

"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FormFieldItem } from "@/components/Form/FormFieldItem";
import { TextInput } from "@/components/Form/Controlled";
import { SingleCardCheckbox } from "@/components/Form/Manual";
import { Para } from "@/components/TextBlocks";
import { USER_PROVIDER_TYPES } from "@/features/core/user/constants";
import { REGISTRATION_ROLES } from "@/features/core/auth/constants/registration";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useRegistration } from "@/features/core/auth/hooks/useRegistration";
import { err, HttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client/app";
import type { UserProviderType } from "@/features/core/user/types";

import { APP_FEATURES } from "@/config/app/app-features.config";
import {
  RoleSelector,
  RoleProfileFields,
} from "@/features/core/userProfile/components/common";
import { REGISTRATION_PROFILES } from "../registrationProfiles";

import { DefaultValues, FormSchema, type FormValues } from "./formEntities";

export function OAuthRegistrationForm() {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: DefaultValues,
  });
  const { register, isLoading } = useRegistration();
  const { refreshSession } = useAuthSession();

  // ロール選択を監視してプロフィールフィールドを動的に更新
  const selectedRole = useWatch({ control: form.control, name: "role" });

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

  const handleSubmit = useCallback(
    async ({ email, displayName, role, profileData, agreeToTerms: _ }: FormValues) => {
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
        {APP_FEATURES.registration.showRoleSelection && (
          <RoleSelector
            control={form.control}
            name="role"
            categories={["user"]}
            selectableRoles={REGISTRATION_ROLES}
            showDescription
            label="アカウントタイプ"
          />
        )}

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

        <RoleProfileFields
          methods={form}
          role={selectedRole}
          profiles={REGISTRATION_PROFILES}
          tag="registration"
          wrapperClassName="space-y-4"
        />

        <FormFieldItem
          control={form.control}
          name="agreeToTerms"
          renderInput={(field) => (
            <SingleCardCheckbox
              field={field}
              label={
                <>
                  <Link href="/terms" className="text-primary hover:underline" target="_blank">利用規約</Link>
                  と
                  <Link href="/privacy-policy" className="text-primary hover:underline" target="_blank">プライバシーポリシー</Link>
                  に同意する
                </>
              }
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

