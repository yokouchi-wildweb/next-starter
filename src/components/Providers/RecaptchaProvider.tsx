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
 * - サイトキーが設定されていない場合は子要素をそのまま返す
 * - バッジはデフォルト非表示（RecaptchaBadgeコンポーネントで規約テキストを表示）
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
      {/* reCAPTCHAバッジをデフォルト非表示（Google公式で許可された方法） */}
      {/* バッジ非表示時は規約テキストの表示が必須（RecaptchaBadgeを使用） */}
      <style jsx global>{`
        .grecaptcha-badge {
          visibility: hidden !important;
        }
      `}</style>
      {children}
    </GoogleReCaptchaProvider>
  );
}
