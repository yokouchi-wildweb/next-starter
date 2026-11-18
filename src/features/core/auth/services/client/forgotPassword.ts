// src/features/core/auth/services/client/forgotPassword.ts

"use client";

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/forgot-password";

/**
 * パスワード再設定メールの送信をサーバーに頼みます。
 * 失敗は HttpError(サーバーの message を優先)で投げます。
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    await axios.post(ENDPOINT, { email });
  } catch (error) {
    throw normalizeHttpError(error, "パスワード再設定メールの送信に失敗しました");
  }
}
