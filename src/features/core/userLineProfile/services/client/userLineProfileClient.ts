// src/features/core/userLineProfile/services/client/userLineProfileClient.ts

"use client";

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";

const UNLINK_ENDPOINT = "/api/auth/line/unlink";

/**
 * ログイン中の利用者の LINE 連携を解除する（POST /api/auth/line/unlink）。
 * UI からはフック経由で呼ぶ（client-service-boundary）。上流はフックを持たないので、fork が useDomainMutation などで包む。
 */
export async function unlinkLine(): Promise<void> {
  try {
    await axios.post(UNLINK_ENDPOINT);
  } catch (error) {
    throw normalizeHttpError(error, "LINE 連携の解除に失敗しました");
  }
}
