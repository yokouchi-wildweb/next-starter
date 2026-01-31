// src/features/core/auth/services/client/sendEarlyRegistrationLink.ts

"use client";

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/send-early-registration-link";

export type SendEarlyRegistrationLinkPayload = {
  email: string;
};

/**
 * サーバー経由で事前登録用認証メールを送信します。
 */
export async function sendEarlyRegistrationLink(
  payload: SendEarlyRegistrationLinkPayload,
): Promise<void> {
  try {
    await axios.post(ENDPOINT, payload);
  } catch (error) {
    throw normalizeHttpError(error, "認証メールの送信に失敗しました");
  }
}
