// src/domains/auth/services/client/preRegistration.ts

"use client";

import axios from "axios";

import type { User } from "@/domains/core/user/entities";
import type { UserProviderType } from "@/domains/core/user/types";
import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/pre-register";

export type PreRegistrationPayload = {
  providerType: UserProviderType;
  providerUid: string;
  idToken: string;
  email?: string;
};

export type PreRegistrationResponse = {
  user: User;
  session: {
    expiresAt: string;
  };
};

export async function preRegister(
  payload: PreRegistrationPayload,
): Promise<PreRegistrationResponse> {
  try {
    const response = await axios.post<PreRegistrationResponse>(ENDPOINT, payload);

    return response.data;
  } catch (error) {
    throw normalizeHttpError(error, "仮登録の処理に失敗しました");
  }
}
