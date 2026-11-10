// src/features/core/accountLifecycle/services/client/withdraw.ts

"use client";

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/account-lifecycle/withdraw";

export async function withdraw(): Promise<void> {
  try {
    await axios.post(ENDPOINT);
  } catch (error) {
    throw normalizeHttpError(error, "退会処理に失敗しました");
  }
}
