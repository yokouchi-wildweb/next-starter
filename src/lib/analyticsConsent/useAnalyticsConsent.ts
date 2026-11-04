"use client";

// src/lib/analyticsConsent/useAnalyticsConsent.ts

import { useSyncExternalStore } from "react";

import { ANALYTICS_CONFIG } from "@/config/app/analytics.config";

import {
  type AnalyticsConsent,
  decideAnalyticsAllowed,
  getAnalyticsConsent,
  subscribeAnalyticsConsent,
} from "./consent";

/**
 * 同意の状態と、送ってよいかを購読するフック。
 * 同意バナーの表示の出し分け（unknown のときだけ出す等）や、同意後に送る処理に使う。
 * サーバーでの描画では consent = unknown として判定する。
 */
export function useAnalyticsConsent(): { consent: AnalyticsConsent; allowed: boolean } {
  const consent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    getAnalyticsConsent,
    () => "unknown" as const,
  );
  return { consent, allowed: decideAnalyticsAllowed(ANALYTICS_CONFIG, consent) };
}
