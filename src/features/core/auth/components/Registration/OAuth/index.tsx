// src/features/core/auth/components/Registration/OAuth/index.tsx

"use client";

import { AppForm } from "@/components/Form/AppForm";
import { Button } from "@/components/Form/Button/Button";
import { ControlledField } from "@/components/Form";
import { SingleCardCheckbox, TextInput } from "@/components/Form/Input/Controlled";
import { Para } from "@/components/TextBlocks";
import { REGISTRATION_ROLES } from "@/features/core/auth/constants/registration";
import { useOAuthRegistrationForm } from "@/features/core/auth/hooks/useOAuthRegistrationForm";
import { RecaptchaBadge, RecaptchaV2Challenge } from "@/lib/recaptcha";

import { authConfig } from "@/features/auth/config";
import { useGate } from "@/featureGate/client";
import {
  RoleSelector,
  RoleProfileFields,
} from "@/features/core/userProfile/components/common";

import { InviteCodeField } from "../InviteCodeField";
import { RateLimitWarningModal } from "../RateLimitWarningModal";

/** 本登録（外部アカウント）の既定の部品。入力・送信の処理は useOAuthRegistrationForm が持ち、ここは描くだけ */
export function OAuthRegistrationForm() {
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
  } = useOAuthRegistrationForm();

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
