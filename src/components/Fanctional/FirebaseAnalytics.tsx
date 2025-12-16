"use client";

// src/components/Fanctional/FirebaseAnalytics.tsx

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/firebase/client/analytics";

/**
 * Firebase Analytics ページビュートラッキングコンポーネント
 * - ルート遷移時に自動でページビューイベントを送信
 * - NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID が未設定の場合は何もしない
 */
export function FirebaseAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;

    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    trackPageView(url);
  }, [pathname, searchParams]);

  return null;
}
