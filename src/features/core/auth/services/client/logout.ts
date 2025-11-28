// src/features/auth/services/client/logout.ts

"use client";

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

const ENDPOINT = "/api/auth/logout";

export async function logout(): Promise<void> {
  try {
    await axios.post(ENDPOINT);
  } catch (error) {
    throw normalizeHttpError(error, "ログアウトに失敗しました");
  }
}

