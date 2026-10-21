"use client";

// src/features/core/pairedDevice/hooks/useDevicePairingCodeFromUrl.ts

import { useSearchParams } from "next/navigation";

/**
 * URL のクエリからペアリングコードを読む（QR から開いたとき用）。無ければ null。
 * - 端末側: 管理者が見せた QR（/device-pair?code=...）→ useClaimDevicePairing({ autoClaimCode }) に渡す
 * - 承認側: 端末が表示した QR（/device-approve?code=...）→ useDevicePairingRequest(code) に渡す
 *
 * useSearchParams を使うので、呼ぶコンポーネントは Suspense の内側に置く（Next.js の制約）。
 */
export function useDevicePairingCodeFromUrl(param = "code"): string | null {
  const searchParams = useSearchParams();
  const value = searchParams.get(param);
  return value && value.trim().length > 0 ? value.trim() : null;
}
