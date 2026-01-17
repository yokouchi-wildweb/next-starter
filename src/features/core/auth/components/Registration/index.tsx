// src/features/auth/components/Registration/index.tsx

"use client";

import type { ComponentType } from "react";

import { ScreenLoader } from "@/components/Overlays/Loading/ScreenLoader";
import { APP_FEATURES } from "@/config/app/app-features.config";
import { useTransitionGuard } from "@/lib/transitionGuard";

import { OAuthRegistrationForm } from "./OAuth"
import { EmailRegistrationForm } from "./Email";
import { UnknownRegistrationForm } from "./UnknownRegistrationForm";
import { RegistrationSteps } from "./RegistrationSteps";

export type RegistrationMethod = "email" | "thirdParty";

export type RegistrationFormProps = {
  method?: RegistrationMethod;
};

const registrationComponentMap: Record<RegistrationMethod, ComponentType> = {
  email: EmailRegistrationForm,
  thirdParty: OAuthRegistrationForm,
};

export function Registration({ method = "email" }: RegistrationFormProps) {
  // 遷移ガード: verify または oauth からのトークン付き遷移のみ許可
  const { isChecking } = useTransitionGuard({
    allowedReferers: ["/signup/verify", "/signup/oauth"],
    onFail: { action: "error" },
  });

  const Component = registrationComponentMap[method] ?? UnknownRegistrationForm;
  const showSteps = APP_FEATURES.auth.signup.showRegistrationSteps;

  // メール認証: 3番目のステップ（基本情報設定）
  // OAuth: 2番目のステップ（プロフィール入力）
  const currentStep = method === "email" ? 2 : 1;

  if (isChecking) {
    return <ScreenLoader mode="local" className="min-h-[300px]" />;
  }

  return (
    <div className="flex flex-col gap-8 pb-8">
      {showSteps && <RegistrationSteps method={method} currentStep={currentStep} />}
      <Component />
    </div>
  );
}
