// src/features/core/auth/components/Registration/Email/index.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { ControlledField } from "@/components/Form";
import { PasswordInput, SingleCardCheckbox, TextInput } from "@/components/Form/Input/Controlled";
import { Input } from "@/components/Form/Input/Manual";
import { Para } from "@/components/TextBlocks";
import { REGISTRATION_ROLES } from "@/features/core/auth/constants/registration";
import { useEmailRegistrationForm } from "@/features/core/auth/hooks/useEmailRegistrationForm";
import { RecaptchaBadge, RecaptchaV2Challenge } from "@/lib/recaptcha";

import { authConfig } from "@/features/auth/config";
import { useGate } from "@/featureGate/client";
import {
  RoleSelector,
  RoleProfileFields,
} from "@/features/core/userProfile/components/common";

import { InviteCodeField } from "../InviteCodeField";
import { RateLimitWarningModal } from "../RateLimitWarningModal";

/** 本登録（メール）の既定の部品。入力・送信の処理は useEmailRegistrationForm が持ち、ここは描くだけ */
export function EmailRegistrationForm() {
  const showInviteCode = useGate().enabled("referral");
  const {
    form,
    onSubmit,
    isLoading,
    rootErrorMessage,
    selectedRole,
    profiles,
    inviteCodeState,
    recaptchaV2,
    rateLimitWarning,
    passwordConfirmationRequired,
  } = useEmailRegistrationForm();

  return (
    <AppForm
      methods={form}
      onSubmit={onSubmit}
      pending={isLoading}
      className="flex flex-col gap-4"
      noValidate
    >
        {authConfig.signup.showRoleSelection && (
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
              placeholder="8文字以上"
              autoComplete="new-password"
            />
          )}
        />

        {passwordConfirmationRequired && (
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
          profiles={profiles}
          tag="registration"
          wrapperClassName="flex flex-col gap-4"
        />

        {showInviteCode && (
          <InviteCodeField control={form.control} state={inviteCodeState} />
        )}

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
          <Para tone="destructive" size="sm">
            {rootErrorMessage}
          </Para>
        ) : null}

        <RecaptchaBadge />

        <Button type="submit" className="w-full justify-center" disabled={isLoading}>
          {isLoading ? "登録処理中..." : "登録を完了"}
        </Button>

        {/* v2チャレンジモーダル */}
        {recaptchaV2.siteKey && (
          <RecaptchaV2Challenge
            open={recaptchaV2.open}
            onClose={recaptchaV2.onClose}
            onVerify={recaptchaV2.onVerify}
            siteKey={recaptchaV2.siteKey}
          />
        )}

        {/* レートリミット警告モーダル */}
        <RateLimitWarningModal
          open={rateLimitWarning.open}
          onOpenChange={rateLimitWarning.onOpenChange}
        />
    </AppForm>
  );
}
