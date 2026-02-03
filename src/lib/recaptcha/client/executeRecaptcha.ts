// src/lib/recaptcha/client/executeRecaptcha.ts

"use client";

import type { RecaptchaAction } from "@/lib/recaptcha/constants";

/**
 * reCAPTCHA v3 トークンを取得する
 *
 * @param executeRecaptcha - react-google-recaptcha-v3のexecuteRecaptcha関数
 * @param action - reCAPTCHAアクション名
 * @returns トークン文字列（取得できない場合はundefined）
 */
export async function getRecaptchaToken(
  executeRecaptcha: ((action: string) => Promise<string>) | undefined,
  action: RecaptchaAction,
): Promise<string | undefined> {
  // executeRecaptchaがundefinedの場合は環境変数未設定
  // サーバー側でも検証がスキップされるのでundefinedを返す（warningなし）
  if (!executeRecaptcha) {
    return undefined;
  }

  try {
    const token = await executeRecaptcha(action);
    return token;
  } catch (error) {
    console.error("Failed to execute reCAPTCHA:", error);
    return undefined;
  }
}
