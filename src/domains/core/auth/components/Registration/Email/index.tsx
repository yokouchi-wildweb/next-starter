// src/domains/core/auth/components/Registration/Email/index.tsx

"use client";

import { AppForm } from "@/lib/formSuite";
import { Button } from "@/components/Button/Button";
import { ControlledField } from "@/lib/formSuite";
import { ControlledPasswordInput, ControlledSingleCardCheckbox, ControlledTextInput } from "@/lib/formSuite";
import { Input } from "@/components/Input/Input";
import { Para } from "@/components/TextBlocks/Para";
import { Span } from "@/components/TextBlocks/Span";
import { REGISTRATION_ROLES } from "@/domains/core/auth/constants/registration";
import { useEmailRegistrationForm } from "@/domains/core/auth/hooks/useEmailRegistrationForm";
import { RecaptchaBadge, RecaptchaV2Challenge } from "@/lib/recaptcha";

import { authConfig } from "@/domains/auth/config";
import { useGate } from "@/featureGate/client";
import {
  RoleSelector,
  RoleProfileFields,
} from "@/domains/core/userProfile/components/common";

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
          label={<Span size="sm" weight="medium">メールアドレス</Span>}
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
            <ControlledTextInput
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
            <ControlledPasswordInput
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
              <ControlledPasswordInput
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
            <ControlledSingleCardCheckbox
              field={field}
              label={
                <>
                  <Span inline tone="primary">利用規約</Span>
                  と
                  <Span inline tone="primary">プライバシーポリシー</Span>
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
