"use client";

// src/features/core/fingerprintChallenge/hooks/useFingerprintChallenge.ts

import useSWR, { type SWRConfiguration } from "swr";

import { fetchMyChallenge } from "@/features/core/fingerprintChallenge/services/client/challengeClient";

/**
 * 回答者本人向けのチャレンジ取得フック。
 * token が null / 空の間はフェッチしない (URL パラメータ解決待ちに対応)。
 */
export function useFingerprintChallenge(token: string | null, config?: SWRConfiguration) {
  return useSWR(
    token ? (["fingerprintChallenge", token] as const) : null,
    async ([, t]) => fetchMyChallenge(t),
    config,
  );
}
