// src/features/auth/services/client/session.ts

"use client";

import axios from "axios";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/session";

export type SessionFetchResponse = {
  user: SessionUser;
  session: {
    expiresAt: string;
  };
};

export async function fetchSession(): Promise<SessionFetchResponse> {
  try {
    const response = await axios.get<SessionFetchResponse>(ENDPOINT);

    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "セッションの取得に失敗しました");
  }
}
