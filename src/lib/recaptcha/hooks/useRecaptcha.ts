// src/lib/recaptcha/hooks/useRecaptcha.ts

"use client";

import { createContext, useContext } from "react";

type RecaptchaContextValue = {
  executeRecaptcha: ((action: string) => Promise<string>) | undefined;
};

/**
 * reCAPTCHA カスタムコンテキスト
 *
 * - GoogleReCaptchaProviderのコンテキストをブリッジする
 * - reCAPTCHA無効時はexecuteRecaptcha=undefinedを提供する
 */
export const RecaptchaContext = createContext<RecaptchaContextValue>({
  executeRecaptcha: undefined,
});

/**
 * reCAPTCHA v3 の executeRecaptcha を安全に取得するカスタムフック
 *
 * - reCAPTCHAが無効（環境変数未設定）の場合、executeRecaptchaはundefined
 * - GoogleReCaptchaProviderが存在しなくてもエラーにならない
 */
export function useRecaptcha() {
  return useContext(RecaptchaContext);
}
