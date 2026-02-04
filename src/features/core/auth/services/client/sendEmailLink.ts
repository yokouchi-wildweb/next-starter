// src/features/core/auth/services/client/sendEmailLink.ts

"use client";

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/send-email-link";

export type SendEmailLinkPayload = {
  email: string;
};

export type SendEmailLinkOptions = {
  /** reCAPTCHA v3 トークン */
  recaptchaToken?: string;
  /** reCAPTCHA v2 トークン（v2チャレンジ完了後のリトライ時） */
  recaptchaV2Token?: string;
};

/**
 * サーバー経由で認証メールを送信します。
 */
export async function sendEmailLink(
  payload: SendEmailLinkPayload,
  options?: SendEmailLinkOptions,
): Promise<void> {
  const headers: Record<string, string> = {};
  if (options?.recaptchaToken) {
    headers["X-Recaptcha-Token"] = options.recaptchaToken;
  }
  if (options?.recaptchaV2Token) {
    headers["X-Recaptcha-V2-Token"] = options.recaptchaV2Token;
  }

  try {
    await axios.post(ENDPOINT, payload, { headers });
  } catch (error) {
    // 428 (v2チャレンジ要求) は呼び出し元で isV2ChallengeRequired で判定するため再スロー
    throw normalizeHttpError(error, "認証メールの送信に失敗しました", {
      rethrowStatuses: [428],
    });
  }
}
