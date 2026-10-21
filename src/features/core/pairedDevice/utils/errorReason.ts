// src/features/core/pairedDevice/utils/errorReason.ts

import {
  PAIRED_DEVICE_ERROR_REASONS,
  type PairedDeviceErrorReason,
} from "@/features/core/pairedDevice/constants";
import { isHttpError } from "@/lib/errors";

/**
 * API エラーから失敗の理由（reason）を取り出す。画面はこれで表示を切り替える。
 * 理由の無いエラー（通信断・500 等）は null。
 */
export function getPairedDeviceErrorReason(error: unknown): PairedDeviceErrorReason | null {
  if (!isHttpError(error)) return null;
  const data = error.responseData;
  if (data && typeof data === "object" && "reason" in data) {
    const reason = (data as { reason?: unknown }).reason;
    if (typeof reason === "string" && (PAIRED_DEVICE_ERROR_REASONS as readonly string[]).includes(reason)) {
      return reason as PairedDeviceErrorReason;
    }
  }
  if (error.status === 429) return "rate_limited";
  return null;
}
