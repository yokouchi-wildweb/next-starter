// src/lib/recaptcha/components/RecaptchaProvider.tsx

"use client";

import {
  GoogleReCaptchaProvider,
  useGoogleReCaptcha,
} from "react-google-recaptcha-v3";
import type { ReactNode } from "react";

import { hasRecaptchaSiteKey, recaptchaSiteKey } from "../siteKey";
import { RecaptchaContext } from "../hooks/useRecaptcha";

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
  if (!hasRecaptchaSiteKey("v3")) {
    return (
      <RecaptchaContext.Provider value={{ executeRecaptcha: undefined }}>
        {children}
      </RecaptchaContext.Provider>
    );
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={recaptchaSiteKey("v3")}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: "head",
      }}
    >
      {/* サイト全体でバッジを非表示。表示したいページにはRecaptchaBadgeを設置 */}
      {/* z-indexは floating(浮く物の層)に設定し、ナビゲーションの引き出しと同じ高さで表示 */}
      <style jsx global>{`
        .grecaptcha-badge {
          visibility: hidden !important;
          z-index: var(--z-layer-floating) !important;
        }
      `}</style>
      <RecaptchaBridge>{children}</RecaptchaBridge>
    </GoogleReCaptchaProvider>
  );
}
