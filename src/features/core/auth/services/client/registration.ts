// src/features/auth/services/client/registration.ts

"use client";

import axios from "axios";
import type { z } from "zod";

import type { User } from "@/features/core/user/entities";
import { RegistrationSchema } from "@/features/core/auth/entities";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/register";

export type RegistrationPayload = z.infer<typeof RegistrationSchema>;

export type RegistrationResponse = {
  user: User;
  session: {
    expiresAt: string;
  };
};

export async function register(
  payload: RegistrationPayload,
): Promise<RegistrationResponse> {
  try {
    const response = await axios.post<RegistrationResponse>(ENDPOINT, payload);

    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "本登録の処理に失敗しました");
  }
}

