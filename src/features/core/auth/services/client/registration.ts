// src/features/auth/services/client/registration.ts

"use client";

import axios from "axios";
import type { z } from "zod";

import type { User } from "@/features/core/user/entities";
import { RegistrationSchema } from "@/features/core/auth/entities";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/register";

export type RegistrationPayload = z.infer<typeof RegistrationSchema>;

export type RegistrationOptions = {
  /** reCAPTCHA v3 トークン */
  recaptchaToken?: string;
};

export type RegistrationResponse = {
  user: User;
  session: {
    expiresAt: string;
  };
};

export async function register(
  payload: RegistrationPayload,
  options?: RegistrationOptions,
): Promise<RegistrationResponse> {
  try {
    const headers: Record<string, string> = {};
    if (options?.recaptchaToken) {
      headers["X-Recaptcha-Token"] = options.recaptchaToken;
    }

    const response = await axios.post<RegistrationResponse>(ENDPOINT, payload, { headers });

    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "本登録の処理に失敗しました");
  }
}

