// src/features/auth/components/Registration/OAuth/index.tsx

"use client";

import { useCallback, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FieldItem } from "@/components/Form";
import { SingleCardCheckbox, TextInput } from "@/components/Form/Input/Controlled";
import { Para } from "@/components/TextBlocks";
import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha/constants";
import { USER_PROVIDER_TYPES } from "@/features/core/user/constants";
import { REGISTRATION_ROLES } from "@/features/core/auth/constants/registration";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useRegistration } from "@/features/core/auth/hooks/useRegistration";
import { err, HttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client/app";
import { getRecaptchaToken, RecaptchaBadge } from "@/lib/recaptcha";
import { useGuardedNavigation } from "@/lib/transitionGuard";
import type { UserProviderType } from "@/features/core/user/types";

import { APP_FEATURES } from "@/config/app/app-features.config";
import {
  RoleSelector,
  RoleProfileFields,
} from "@/features/core/userProfile/components/common";
import { REGISTRATION_PROFILES } from "../registrationProfiles";

import { DefaultValues, FormSchema, type FormValues } from "./formEntities";

export function OAuthRegistrationForm() {
  const { guardedPush } = useGuardedNavigation();
  const { executeRecaptcha } = useGoogleReCaptcha();
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
    name: currentUser?.displayName ?? "",
  };
  const isSubmitted = form.formState.isSubmitted;

  useEffect(() => {
    form.setValue("email", providerProfile.email, {
      shouldValidate: isSubmitted,
    });
    form.setValue("name", providerProfile.name, {
      shouldValidate: isSubmitted,
    });
  }, [form, isSubmitted, providerProfile.name, providerProfile.email]);

  const handleSubmit = useCallback(
    async ({ email, name, role, profileData, agreeToTerms: _ }: FormValues) => {
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

        // reCAPTCHA トークンを取得
        const recaptchaToken = await getRecaptchaToken(
          executeRecaptcha,
          RECAPTCHA_ACTIONS.REGISTER,
        );

        await register({
          providerType: providerId as UserProviderType,
          providerUid: currentUser.uid,
          idToken,
          email,
          name,
          role,
          profileData,
        }, { recaptchaToken });

        await refreshSession();
        guardedPush("/signup/complete");
      } catch (error) {
        const message = err(error, "本登録の処理に失敗しました");
        form.setError("root", { type: "server", message });
      }
    },
    [form, refreshSession, register, guardedPush, executeRecaptcha],
  );

  const rootErrorMessage = form.formState.errors.root?.message ?? null;

  return (
    <AppForm
      methods={form}
      onSubmit={handleSubmit}
      pending={isLoading}
      className="flex flex-col gap-4"
      noValidate
    >
        {APP_FEATURES.auth.signup.showRoleSelection && (
          <RoleSelector
            control={form.control}
            name="role"
            categories={["user"]}
            selectableRoles={REGISTRATION_ROLES}
            showDescription
            label="アカウントタイプ"
          />
        )}

        <FieldItem
          control={form.control}
          name="email"
          label="メールアドレス"
          required
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

        <FieldItem
          control={form.control}
          name="name"
          label="表示名"
          required
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
          wrapperClassName="flex flex-col gap-4"
        />

        <FieldItem
          control={form.control}
          name="agreeToTerms"
          renderInput={(field) => (
            <SingleCardCheckbox
              field={field}
              label={
                <>
                  <span className="text-primary">利用規約</span>
                  と
                  <span className="text-primary">プライバシーポリシー</span>
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

        <RecaptchaBadge />

        <Button type="submit" className="w-full justify-center" disabled={isLoading}>
          {isLoading ? "登録処理中..." : "登録を完了"}
        </Button>
    </AppForm>
  );
}
