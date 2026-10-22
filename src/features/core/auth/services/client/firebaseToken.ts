// src/features/core/auth/services/client/firebaseToken.ts

"use client";

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/firebase-token";

type FirebaseTokenResponse = {
  firebaseCustomToken: string;
};

/**
 * 現在のセッションに対応する Firebase カスタムトークンを取得する。
 * Firebase Auth との同期が切れたときの再サインインに使う。
 */
export async function fetchFirebaseCustomToken(): Promise<string> {
  try {
    const { data } = await axios.post<FirebaseTokenResponse>(ENDPOINT);
    return data.firebaseCustomToken;
  } catch (error) {
    throw normalizeHttpError(error, "Firebase トークンの取得に失敗しました");
  }
}
