"use client";

// src/domains/core/deviceFingerprint/hooks/useFingerprintReport.ts

import { useEffect, useRef } from "react";

import type { SessionUser } from "@/domains/core/auth/entities/session";
import { useGate } from "@/featureGate/client";
import { collectFingerprintPayload } from "@/lib/fingerprint";
import { reportFingerprint } from "@/domains/core/deviceFingerprint/services/client/fingerprintClient";

const STORAGE_KEY = "fp_last_report";

/**
 * 全ページ設置型のフィンガープリント収集フック — 認証済みユーザーに対して
 * 1 日 1 回だけ収集 + 送信する (useDauTracker と同じデデュプ戦略)。
 *
 * ログイン後レイアウト等に 1 行置くだけでよい:
 *   useFingerprintReport(user);
 *
 * - fire-and-forget: 収集・送信の失敗はユーザー体験に影響しない
 * - 収集の口の機能 deviceFingerprintPageIngest(親 deviceFingerprint、既定は閉)が閉じていれば何も送らない
 *   (門番の useGate で判定。閉じた口へ毎日送って 404 を捨てる形にしない)。フック設置自体は機能の入切と独立して常置できる
 * - DB 側は (user_id, composite_hash) upsert で冪等なため、localStorage が
 *   消えて再送されても行は増えない
 */
export function useFingerprintReport(user: SessionUser | null): void {
  const hasReportedRef = useRef(false);
  const ingestOpen = useGate().enabled("deviceFingerprintPageIngest");

  useEffect(() => {
    if (!ingestOpen || !user || user.isDemo || hasReportedRef.current) return;

    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

    try {
      if (localStorage.getItem(STORAGE_KEY) === today) return;
    } catch {
      // localStorage 利用不可 (プライベートブラウジング等) はスキップせず送信
    }

    hasReportedRef.current = true;

    collectFingerprintPayload()
      .then((payload) => reportFingerprint(payload))
      .then(() => {
        try {
          localStorage.setItem(STORAGE_KEY, today);
        } catch {
          // 書き込み失敗は無視 (次回リロード時に再送されるだけ。DB 側は冪等)
        }
      })
      .catch(() => {
        // 収集・送信失敗は静かに無視 (fire-and-forget)
        hasReportedRef.current = false;
      });
  }, [ingestOpen, user]);
}
