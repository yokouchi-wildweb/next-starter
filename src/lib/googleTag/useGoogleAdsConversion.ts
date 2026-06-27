"use client";

// src/lib/googleTag/useGoogleAdsConversion.ts

import { useCallback, useRef } from "react";

import {
  GOOGLE_ADS_CONVERSIONS,
  trackGoogleAdsConversion,
  type GoogleAdsConversionKey,
} from "./googleTag";

/**
 * transaction_id ベースの dedup セット
 * - module スコープのため mount 跨ぎ・再レンダー跨ぎ・StrictMode 二重実行でも二重計上を防ぐ
 */
const firedTransactions = new Set<string>();

type FireOptions = {
  value?: number;
  currency?: string;
  /** 指定時は transaction_id 単位で dedup（コイン購入等）。未指定時は mount あたり 1 回 */
  transactionId?: string;
};

/**
 * named Google Ads コンバージョンを発火するフック
 * - 発火ロジック（env 解決・dedup・mount ガード）を一元化し、各発火サイトはキーを渡すだけ
 * - env 未設定（send_to undefined）なら no-op なので、未設定サイトでは安全に inert
 *
 * @example signup（mount あたり 1 回）
 * ```tsx
 * const { fire } = useGoogleAdsConversion();
 * useEffect(() => { if (isValidTransition) fire("signup"); }, [isValidTransition, fire]);
 * ```
 *
 * @example coinPurchase（transaction_id で dedup）
 * ```tsx
 * fire("coinPurchase", { value: paymentAmount, currency: "JPY", transactionId: requestId });
 * ```
 */
export function useGoogleAdsConversion() {
  // transactionId を持たないコンバージョン用の mount あたり 1 回ガード
  const firedOnceRef = useRef(false);

  const fire = useCallback(
    (key: GoogleAdsConversionKey, options: FireOptions = {}): void => {
      const sendTo = GOOGLE_ADS_CONVERSIONS[key];
      if (!sendTo) return; // env 未設定 → no-op

      const { transactionId } = options;
      if (transactionId) {
        if (firedTransactions.has(transactionId)) return;
        firedTransactions.add(transactionId);
      } else {
        if (firedOnceRef.current) return;
        firedOnceRef.current = true;
      }

      trackGoogleAdsConversion({ sendTo, ...options });
    },
    []
  );

  return { fire };
}
