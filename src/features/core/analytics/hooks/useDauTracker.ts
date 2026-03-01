"use client";

import { useEffect, useRef } from "react";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { recordDau } from "@/features/core/analytics/services/client/dauClient";

const STORAGE_KEY = "dau_last_ping";

/**
 * DAUトラッカー — 認証済みユーザーに対して1日1回だけDAU記録APIを呼び出す
 *
 * デデュプ戦略:
 * - localStorage に最終ping日 (YYYY-MM-DD) を保存
 * - 今日の日付と異なる場合のみAPIを呼び出し
 * - UPSERT (DO NOTHING) でDB側も冪等なため、localStorageが消えても安全
 */
export function useDauTracker(user: SessionUser | null) {
  const hasPingedRef = useRef(false);

  useEffect(() => {
    if (!user || user.isDemo || hasPingedRef.current) return;

    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

    try {
      const lastPing = localStorage.getItem(STORAGE_KEY);
      if (lastPing === today) return;
    } catch {
      // localStorage利用不可（プライベートブラウジング等）の場合はスキップせず送信
    }

    hasPingedRef.current = true;

    recordDau()
      .then(() => {
        try {
          localStorage.setItem(STORAGE_KEY, today);
        } catch {
          // 書き込み失敗は無視（次回リロード時に再送されるだけ）
        }
      })
      .catch(() => {
        // 記録失敗は静かに無視（ユーザー体験に影響しない）
        hasPingedRef.current = false;
      });
  }, [user]);
}
