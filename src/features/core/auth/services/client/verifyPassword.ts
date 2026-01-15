// src/features/core/auth/services/client/verifyPassword.ts

"use client";

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/verify-password";

export type VerifyPasswordPayload = {
  password: string;
};

export type VerifyPasswordResponse = {
  valid: boolean;
  message?: string;
};

/**
 * 現在ログイン中のユーザーのパスワードを検証する
 */
export async function verifyPassword(
  payload: VerifyPasswordPayload
): Promise<boolean> {
  try {
    const response = await axios.post<VerifyPasswordResponse>(ENDPOINT, payload);
    return response.data.valid;
  } catch (error) {
    // 401エラー（パスワード不一致）はfalseを返す
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return false;
    }
    throw normalizeHttpError(error, "パスワード検証に失敗しました");
  }
}
