// src/features/core/auth/services/client/demoLogin.ts

"use client";

import axios from "axios";

import type { SessionUser } from "@/features/core/auth/entities/session";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/guest-login";

export type DemoLoginInput = {
  demoUserId?: string | null;
};

export type DemoLoginResponse = {
  user: SessionUser;
  demoUserId: string;
  isNewUser: boolean;
  session: {
    expiresAt: string;
  };
};

export async function demoLogin(input: DemoLoginInput = {}): Promise<DemoLoginResponse> {
  try {
    const response = await axios.post<DemoLoginResponse>(ENDPOINT, {
      demoUserId: input.demoUserId ?? null,
    });

    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "デモログインに失敗しました");
  }
}
