// src/features/auth/services/client/localLogin.ts

"use client";

import axios from "axios";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/local/login";

export type LocalLoginPayload = {
  email: string;
  password: string;
};

export type LocalLoginResponse = {
  user: SessionUser;
  session: {
    expiresAt: string;
  };
};

export async function localLogin(payload: LocalLoginPayload): Promise<LocalLoginResponse> {
  try {
    const response = await axios.post<LocalLoginResponse>(ENDPOINT, payload);

    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "ログインに失敗しました");
  }
}
