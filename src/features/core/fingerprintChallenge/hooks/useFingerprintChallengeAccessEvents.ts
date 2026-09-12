"use client";

// src/features/core/fingerprintChallenge/hooks/useFingerprintChallengeAccessEvents.ts

import useSWR, { type SWRConfiguration } from "swr";

import { fetchChallengeAccessEvents } from "@/features/core/fingerprintChallenge/services/client/adminChallengeClient";

/**
 * 管理者向け: チャレンジ別のアクセスイベント (開いた日時 + IP + UA) をページ取得するフック。
 * challengeId が null の間はフェッチしない。
 */
export function useFingerprintChallengeAccessEvents(
  challengeId: string | null,
  params: { page?: number; limit?: number } = {},
  config?: SWRConfiguration,
) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  return useSWR(
    challengeId ? (["fingerprintChallengeAccessEvents", challengeId, page, limit] as const) : null,
    async ([, id, p, l]) => fetchChallengeAccessEvents(id, { page: p, limit: l }),
    config,
  );
}
