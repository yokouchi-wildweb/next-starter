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
};

/**
 * サーバー経由で認証メールを送信します。
 */
export async function sendEmailLink(
  payload: SendEmailLinkPayload,
  options?: SendEmailLinkOptions,
): Promise<void> {
  try {
    const headers: Record<string, string> = {};
    if (options?.recaptchaToken) {
      headers["X-Recaptcha-Token"] = options.recaptchaToken;
    }

    await axios.post(ENDPOINT, payload, { headers });
  } catch (error) {
    throw normalizeHttpError(error, "認証メールの送信に失敗しました");
  }
}
