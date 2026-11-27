// src/domains/auth/services/client/firebaseSession.ts

"use client";

import axios from "axios";

import type { LoginAnnouncement } from "@/domains/core/auth/constants/loginAnnouncement";
import type { SessionUser } from "@/domains/core/auth/entities/session";
import type { UserProviderType } from "@/domains/core/user/types";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/firebase/login";

export type FirebaseSessionPayload = {
  providerType: UserProviderType;
  providerUid: string;
  idToken: string;
  /** ログインの後(読み直しの後)に出す知らせ。省略 = 出さない */
  announce?: LoginAnnouncement;
};

export type FirebaseSessionResponse = {
  user: SessionUser;
  session: {
    expiresAt: string;
  };
  requiresReactivation: boolean;
};

export async function createFirebaseSession(
  payload: FirebaseSessionPayload,
): Promise<FirebaseSessionResponse> {
  try {
    const response = await axios.post<FirebaseSessionResponse>(ENDPOINT, payload);

    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "セッションの作成に失敗しました");
  }
}
