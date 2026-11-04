"use client";

// src/components/Fanctional/FirebaseAnalytics.tsx

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useAnalyticsConsent } from "@/lib/analyticsConsent";
import { trackPageView } from "@/lib/firebase/client/analytics";

/**
 * Firebase Analytics ページビュートラッキングコンポーネント
 * - ルート遷移時に自動でページビューイベントを送信
 * - 送ってよいとき（ANALYTICS_CONFIG.enabled かつ同意あり。@/lib/analyticsConsent）だけ送る
 * - 同意が後から出たら、その時点のページのページビューを 1 回送る
 * - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID が未設定の場合は何もしない
 */
export function FirebaseAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { allowed } = useAnalyticsConsent();

  useEffect(() => {
    if (!pathname || !allowed) return;

    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    trackPageView(url);
  }, [pathname, searchParams, allowed]);

  return null;
}
