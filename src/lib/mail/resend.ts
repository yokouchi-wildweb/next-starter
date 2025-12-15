// src/lib/mail/resend.ts

import { Resend } from "resend";

function getResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY が設定されていません。環境変数を確認してください。",
    );
  }
  return apiKey;
}

let resendInstance: Resend | null = null;

/**
 * Resendクライアントのシングルトンインスタンスを取得します。
 */
export function getResendClient(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(getResendApiKey());
  }
  return resendInstance;
}
