// src/lib/firebase/client/analytics.ts

import { Analytics, getAnalytics, logEvent } from "firebase/analytics";
import { app } from "./app";

let analytics: Analytics | null = null;

/**
 * Firebase Analytics インスタンスを取得
 * - SSR環境では null を返す
 * - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID が未設定の場合は null を返す
 */
export function getFirebaseAnalytics(): Analytics | null {
  if (typeof window === "undefined") return null;

  const measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
  if (!measurementId) return null;

  if (!analytics) {
    analytics = getAnalytics(app);
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
