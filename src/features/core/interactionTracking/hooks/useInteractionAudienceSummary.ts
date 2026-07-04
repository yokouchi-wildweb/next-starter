// src/features/core/interactionTracking/hooks/useInteractionAudienceSummary.ts
// オーディエンスサマリー取得フック（admin 専用 UI 用）

"use client";

import useSWR, { type SWRConfiguration } from "swr";

import { fetchInteractionAudienceSummary } from "@/features/core/interactionTracking/services/client/interactionAdminClient";

/**
 * action 別サマリー（累計 / ログイン済み / 匿名）を取得する。
 * `enabled: false`（モーダル閉時など）はフェッチしない。
 */
export function useInteractionAudienceSummary(
  targetType: string,
  targetId: string,
  options: { enabled?: boolean } = {},
  config?: SWRConfiguration,
) {
  const enabled = options.enabled ?? true;
  const key = enabled && targetType && targetId
    ? (["interactionAudienceSummary", targetType, targetId] as const)
    : null;

  return useSWR(
    key,
    async () => fetchInteractionAudienceSummary(targetType, targetId),
    config,
  );
}
