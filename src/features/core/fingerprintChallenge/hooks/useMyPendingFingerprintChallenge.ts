"use client";

// src/features/core/fingerprintChallenge/hooks/useMyPendingFingerprintChallenge.ts

import useSWR, { type SWRConfiguration } from "swr";

import { fetchMyPendingChallenge } from "@/features/core/fingerprintChallenge/services/client/challengeClient";

/**
 * ログイン本人の未回答チャレンジ (最新・期限内) を取得するフック。
 * トークンを持たない経路 (/restricted 等の着地ページ CTA、トークン無しの回答ページ) 用。
 * data は無ければ null。提出は useSubmitFingerprintChallenge の submit({ id: data.id }, ...)。
 */
export function useMyPendingFingerprintChallenge(config?: SWRConfiguration) {
  return useSWR(["fingerprintChallenge", "pending"] as const, fetchMyPendingChallenge, config);
}
