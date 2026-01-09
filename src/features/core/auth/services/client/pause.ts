// src/features/core/auth/services/client/pause.ts

"use client";

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/pause";

export async function pause(): Promise<void> {
  try {
    await axios.post(ENDPOINT);
  } catch (error) {
    throw normalizeHttpError(error, "休会処理に失敗しました");
  }
}
