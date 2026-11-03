// src/features/core/userXProfile/services/client/userXProfileClient.ts

"use client";

import axios from "axios";
import { normalizeHttpError } from "@/lib/errors";

const UNLINK_ENDPOINT = "/api/auth/x/unlink";

/**
 * ログイン中の利用者の X 連携を解除する（POST /api/auth/x/unlink。X 側のトークンも revoke される）。
 * UI からはフック経由で呼ぶ（client-service-boundary）。上流はフックを持たないので、fork が useDomainMutation などで包む。
 */
export async function unlinkX(): Promise<void> {
  try {
    await axios.post(UNLINK_ENDPOINT);
  } catch (error) {
    throw normalizeHttpError(error, "X 連携の解除に失敗しました");
  }
}
