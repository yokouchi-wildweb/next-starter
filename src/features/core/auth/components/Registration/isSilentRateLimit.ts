// src/features/core/auth/components/Registration/isSilentRateLimit.ts

import type { HttpError } from "@/lib/errors";

/**
 * サブネット単位のレート制限（silent: true）かどうかを判定する。
 * silent の場合はモーダルではなくフォームエラーとして表示する。
 */
export function isSilentRateLimit(error: HttpError): boolean {
  const data = error.responseData;
  return typeof data === "object" && data !== null && "silent" in data && (data as { silent: boolean }).silent === true;
}
