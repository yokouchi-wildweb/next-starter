// src/features/core/accountLifecycle/services/client/reactivate.ts

"use client";

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/account-lifecycle/reactivate";

export async function reactivate(): Promise<void> {
  try {
    await axios.post(ENDPOINT);
  } catch (error) {
    throw normalizeHttpError(error, "復帰処理に失敗しました");
  }
}
