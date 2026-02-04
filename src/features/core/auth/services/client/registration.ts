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
  /** reCAPTCHA v2 トークン（v2チャレンジ完了後のリトライ時） */
  recaptchaV2Token?: string;
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
  const headers: Record<string, string> = {};
  if (options?.recaptchaToken) {
    headers["X-Recaptcha-Token"] = options.recaptchaToken;
  }
  if (options?.recaptchaV2Token) {
    headers["X-Recaptcha-V2-Token"] = options.recaptchaV2Token;
  }

  try {
    const response = await axios.post<RegistrationResponse>(ENDPOINT, payload, { headers });

    return response.data;
  } catch (error) {
    // 428 (v2チャレンジ要求) は呼び出し元で isV2ChallengeRequired で判定するため再スロー
    throw normalizeHttpError(error, "本登録の処理に失敗しました", {
      rethrowStatuses: [428],
    });
  }
}

