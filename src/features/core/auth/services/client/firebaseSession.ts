// src/features/auth/services/client/firebaseSession.ts

"use client";

import axios from "axios";

import type { SessionUser } from "@/features/core/auth/entities/session";
import type { UserProviderType } from "@/types/user";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/firebase/login";

export type FirebaseSessionPayload = {
  providerType: UserProviderType;
  providerUid: string;
  idToken: string;
};

export type FirebaseSessionResponse = {
  user: SessionUser;
  session: {
    expiresAt: string;
  };
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
