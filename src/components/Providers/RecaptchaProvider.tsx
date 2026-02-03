// src/components/Providers/RecaptchaProvider.tsx

"use client";

import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import type { ReactNode } from "react";

import { RECAPTCHA_INTERNALS } from "@/lib/recaptcha/constants";

type RecaptchaProviderProps = {
  children: ReactNode;
};

/**
 * reCAPTCHA v3 Provider
 *
 * サイトキーが設定されていない場合は子要素をそのまま返す
 */
export function RecaptchaProvider({ children }: RecaptchaProviderProps) {
  // サイトキーが無効（未設定または短すぎる）の場合はProviderをスキップ
  if (!RECAPTCHA_INTERNALS.hasSiteKey) {
    return <>{children}</>;
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={RECAPTCHA_INTERNALS.siteKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: "head",
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  );
}
