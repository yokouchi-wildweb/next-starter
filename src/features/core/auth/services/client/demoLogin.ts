// src/features/core/auth/services/client/demoLogin.ts

"use client";

import axios from "axios";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/demo/login";

export type DemoLoginResponse = {
  user: SessionUser;
  session: {
    expiresAt: string;
  };
};

export async function demoLogin(): Promise<DemoLoginResponse> {
  try {
    const response = await axios.post<DemoLoginResponse>(ENDPOINT);

    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "デモログインに失敗しました");
  }
}
