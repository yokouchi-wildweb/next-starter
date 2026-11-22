// src/domains/auth/services/client/firebaseSession.ts

"use client";

import axios from "axios";

import type { SessionUser } from "@/domains/core/auth/entities/session";
import type { UserProviderType } from "@/domains/core/user/types";
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
