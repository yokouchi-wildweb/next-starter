// src/components/Providers/RecaptchaProvider.tsx

"use client";

import {
  GoogleReCaptchaProvider,
  useGoogleReCaptcha,
} from "react-google-recaptcha-v3";
import type { ReactNode } from "react";

import { RECAPTCHA_V3_INTERNALS } from "@/lib/recaptcha/constants";
import { RecaptchaContext } from "@/lib/recaptcha/hooks/useRecaptcha";

type RecaptchaProviderProps = {
  children: ReactNode;
};

/**
 * GoogleReCaptchaProviderのコンテキストをカスタムコンテキストにブリッジする内部コンポーネント
 */
function RecaptchaBridge({ children }: { children: ReactNode }) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  return (
    <RecaptchaContext.Provider value={{ executeRecaptcha }}>
      {children}
    </RecaptchaContext.Provider>
  );
}

/**
 * reCAPTCHA v3 Provider
 *
 * - サイトキーが設定されていない場合はカスタムコンテキストでundefinedを提供
 * - バッジはデフォルト非表示（RecaptchaBadgeコンポーネントを設置したページでのみ表示）
 */
export function RecaptchaProvider({ children }: RecaptchaProviderProps) {
  // サイトキーが無効（未設定または短すぎる）の場合はProviderをスキップ
  if (!RECAPTCHA_V3_INTERNALS.hasSiteKey) {
    return (
      <RecaptchaContext.Provider value={{ executeRecaptcha: undefined }}>
        {children}
      </RecaptchaContext.Provider>
    );
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={RECAPTCHA_V3_INTERNALS.siteKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: "head",
      }}
    >
      {/* サイト全体でバッジを非表示。表示したいページにはRecaptchaBadgeを設置 */}
      <style jsx global>{`
        .grecaptcha-badge {
          visibility: hidden !important;
        }
      `}</style>
      <RecaptchaBridge>{children}</RecaptchaBridge>
    </GoogleReCaptchaProvider>
  );
}
