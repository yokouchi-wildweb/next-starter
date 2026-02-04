// src/features/auth/components/Registration/Email/index.tsx

"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { ControlledField } from "@/components/Form";
import { PasswordInput, SingleCardCheckbox, TextInput } from "@/components/Form/Input/Controlled";
import { Input } from "@/components/Form/Input/Manual";
import { Para } from "@/components/TextBlocks";
import { RECAPTCHA_ACTIONS } from "@/lib/recaptcha/constants";
import { EMAIL_SIGNUP_STORAGE_KEY } from "@/features/core/auth/constants/localStorage";
import { REGISTRATION_ROLES } from "@/features/core/auth/constants/registration";
import { useAuthSession } from "@/features/core/auth/hooks/useAuthSession";
import { useRegistration } from "@/features/core/auth/hooks/useRegistration";
import type { RegistrationInput } from "@/features/core/auth/hooks/useRegistration";
import { useLocalStorage } from "@/lib/browserStorage";
import { err, HttpError } from "@/lib/errors";
import { auth } from "@/lib/firebase/client/app";
import {
  getRecaptchaToken,
  RecaptchaBadge,
  RecaptchaV2Challenge,
  useRecaptchaV2Challenge,
  isV2ChallengeRequired,
} from "@/lib/recaptcha";
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
  const { executeRecaptcha } = useGoogleReCaptcha();
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

  // v2チャレンジの状態管理
  const {
    challengeState,
    handleV2ChallengeRequired,
    handleV2Verify,
    closeChallenge,
    hasV2Token,
  } = useRecaptchaV2Challenge();

  // v2認証成功後に再送信するためのペイロード保存
  const pendingPayloadRef = useRef<RegistrationInput | null>(null);

  // ロール選択を監視してプロフィールフィールドを動的に更新
  const selectedRole = useWatch({ control: form.control, name: "role" });

  useEffect(() => {
    form.setValue("email", email, { shouldValidate: form.formState.isSubmitted });
  }, [email, form]);

  // v2認証成功後に自動的に再送信
  useEffect(() => {
    if (hasV2Token && pendingPayloadRef.current) {
      const payload = pendingPayloadRef.current;
      pendingPayloadRef.current = null;
      // v2トークンで再送信
      register(payload, { recaptchaV2Token: challengeState.v2Token ?? undefined })
        .then(async () => {
          await refreshSession();
          guardedPush("/signup/complete");
        })
        .catch((error) => {
          const message = err(error, "本登録の処理に失敗しました");
          form.setError("root", { type: "server", message });
        });
    }
  }, [hasV2Token, challengeState.v2Token, register, refreshSession, guardedPush, form]);

  const handleSubmit = useCallback(
    async ({ email: emailValue, name, password, role, profileData, agreeToTerms: _ }: FormValues) => {
      try {
        const currentUser = auth.currentUser;

        if (!currentUser) {
          throw new HttpError({
            message: "認証情報が確認できませんでした。再度メール認証からお試しください。",
            status: 401,
          });
        }

        const idToken = await currentUser.getIdToken();

        // reCAPTCHA トークンを取得
        const recaptchaToken = await getRecaptchaToken(
          executeRecaptcha,
          RECAPTCHA_ACTIONS.REGISTER,
        );

        const payload: RegistrationInput = {
          providerType: "email",
          providerUid: currentUser.uid,
          idToken,
          email: emailValue,
          name,
          password,
          role,
          profileData,
        };

        await register(payload, { recaptchaToken });
        await refreshSession();
        guardedPush("/signup/complete");
      } catch (error) {
        // v2チャレンジが必要な場合
        if (isV2ChallengeRequired(error)) {
          const currentUser = auth.currentUser;
          if (currentUser) {
            const idToken = await currentUser.getIdToken();
            const values = form.getValues();
            pendingPayloadRef.current = {
              providerType: "email",
              providerUid: currentUser.uid,
              idToken,
              email: values.email,
              name: values.name,
              password: values.password,
              role: values.role,
              profileData: values.profileData,
            };
          }
          handleV2ChallengeRequired(error);
          return;
        }
        const message = err(error, "本登録の処理に失敗しました");
        form.setError("root", { type: "server", message });
      }
    },
    [form, refreshSession, register, guardedPush, executeRecaptcha, handleV2ChallengeRequired],
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

        <ControlledField
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

        <ControlledField
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

        <ControlledField
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
          <ControlledField
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

        <ControlledField
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

        {/* v2チャレンジモーダル */}
        {challengeState.siteKey && (
          <RecaptchaV2Challenge
            open={challengeState.isOpen}
            onClose={closeChallenge}
            onVerify={handleV2Verify}
            siteKey={challengeState.siteKey}
          />
        )}
    </AppForm>
  );
}
