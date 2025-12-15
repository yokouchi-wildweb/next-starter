// src/features/core/auth/services/client/sendEmailLink.ts

"use client";

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/send-email-link";

export type SendEmailLinkPayload = {
  email: string;
};

/**
 * サーバー経由で認証メールを送信します。
 */
export async function sendEmailLink(payload: SendEmailLinkPayload): Promise<void> {
  try {
    await axios.post(ENDPOINT, payload);
  } catch (error) {
    throw normalizeHttpError(error, "認証メールの送信に失敗しました");
  }
}
