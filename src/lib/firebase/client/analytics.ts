// src/lib/firebase/client/analytics.ts

import {
  type Analytics,
  initializeAnalytics,
  logEvent,
  setAnalyticsCollectionEnabled,
} from "firebase/analytics";

import { isAnalyticsAllowed, subscribeAnalyticsConsent } from "@/lib/analyticsConsent";

import { app, isFirebaseClientConfigured } from "./app";

let analytics: Analytics | null = null;

// 同意が取り消されたら、初期化済みのインスタンスの収集を止める（再び許可されたら戻す）
if (typeof window !== "undefined") {
  subscribeAnalyticsConsent(() => {
    if (analytics) setAnalyticsCollectionEnabled(analytics, isAnalyticsAllowed());
  });
}

/**
 * Firebase Analytics インスタンスを取得
 * - SSR環境では null を返す
 * - Firebase クライアント自体が未設定の場合は null を返す
 * - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID が未設定の場合は null を返す
 * - 送ってよくない（ANALYTICS_CONFIG.enabled が false、または同意が無い）場合は null を返す。
 *   初期化は呼んだ時点で gtag を読み込むので、許可が出るまで初期化しない（@/lib/analyticsConsent）
 */
export function getFirebaseAnalytics(): Analytics | null {
  if (typeof window === "undefined") return null;
  if (!isFirebaseClientConfigured()) return null;

  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
  if (!measurementId) return null;

  if (!isAnalyticsAllowed()) return null;

  if (!analytics) {
    // send_page_view: false = 初期化で gtag が自分で page_view を送らない。page_view は <FirebaseAnalytics /> がルートごとに 1 回だけ送る
    // (既定の true のままだと最初のページが 2 回数えられる)
    analytics = initializeAnalytics(app, { config: { send_page_view: false } });
  }

  return analytics;
}

/**
 * ページビューイベントを送信
 */
export function trackPageView(pagePath: string, pageTitle?: string): void {
  const analyticsInstance = getFirebaseAnalytics();
  if (!analyticsInstance) return;

  logEvent(analyticsInstance, "page_view", {
    page_path: pagePath,
    page_title: pageTitle || document.title,
  });
}

/**
 * カスタムイベントを送信
 */
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, unknown>
): void {
  const analyticsInstance = getFirebaseAnalytics();
  if (!analyticsInstance) return;

  logEvent(analyticsInstance, eventName, eventParams);
}
