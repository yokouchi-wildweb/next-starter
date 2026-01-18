// src/features/auth/components/Registration/Email/index.tsx

"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Link from "next/link";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { FieldItem } from "@/components/Form";
import { PasswordInput, SingleCardCheckbox, TextInput } from "@/components/Form/Input/Controlled";
import { Input } from "@/components/Form/Input/Manual";
import { Para } from "@/components/TextBlocks";
import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/core/auth/constants/localStorage";
import { REGISTRATION_ROLES } from "@/features/core/auth/constants/registration";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useRegistration } from "@/features/core/auth/hooks/useRegistration";
import { useLocalStorage } from "@/lib/browserStorage";
import { err, HttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client/app";
import { useGuardedNavigation } from "@/lib/transitionGuard";

import { APP_FEATURES } from "@/config/app/app-features.config";
import {
  RoleSelector,
  RoleProfileFields,
} from "@/features/core/userProfile/components/common";
import { REGISTRATION_PROFILES } from "../registrationProfiles";

import { FormSchema, type FormValues, DefaultValues, isDoubleMode } from "./formEntities";

export function EmailRegistrationForm() {
  const { guardedPush } = useGuardedNavigation();
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
    async ({ email: emailValue, displayName, password, role, profileData, agreeToTerms: _ }: FormValues) => {
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
        guardedPush("/signup/complete");
      } catch (error) {
        const message = err(error, "本登録の処理に失敗しました");
        form.setError("root", { type: "server", message });
      }
    },
    [form, refreshSession, register, guardedPush],
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

        <FieldItem
          control={form.control}
          name="displayName"
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

        <FieldItem
          control={form.control}
          name="password"
          label="パスワード"
          required
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
          <FieldItem
            control={form.control}
            name="passwordConfirmation"
            label="パスワード（確認）"
            required
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
