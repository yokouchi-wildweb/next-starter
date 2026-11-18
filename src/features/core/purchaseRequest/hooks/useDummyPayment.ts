// src/features/core/purchaseRequest/hooks/useDummyPayment.ts
//
// ダミー決済の画面(DummyPaymentForm)の送信: 結果をダミーの webhook に知らせ、成功・失敗の URL へ移る。
// 二重送信は lock で止め、失敗したら lock を外して再試行できるようにする。

"use client";

import { useCallback, useRef, useState } from "react";

import { notifyDummyPayment } from "@/features/core/purchaseRequest/services/client/purchaseRequestClient";

export type UseDummyPaymentParams = {
  sessionId: string | null;
  successUrl: string | null;
  cancelUrl: string | null;
  paymentMethod: string | null;
};

export type UseDummyPaymentReturn = {
  /** success = true で決済成功、false で決済失敗を知らせる */
  pay: (success: boolean) => Promise<void>;
  loading: boolean;
  error: string | null;
};

const ERROR_MESSAGE = "決済処理中にエラーが発生しました。";

export function useDummyPayment({
  sessionId,
  successUrl,
  cancelUrl,
  paymentMethod,
}: UseDummyPaymentParams): UseDummyPaymentReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  const pay = useCallback(
    async (success: boolean) => {
      if (!sessionId || !successUrl || !cancelUrl) return;
      if (lockRef.current) return;
      lockRef.current = true;
      setLoading(true);
      setError(null);

      try {
        await notifyDummyPayment({ success, sessionId, paymentMethod });
        // 成功または失敗の URL へ移る(移るまで loading のまま)
        if (success) {
          window.location.assign(successUrl);
        } else {
          window.location.assign(`${cancelUrl}&error_code=PAYMENT_FAILED`);
        }
      } catch (err) {
        console.error("Payment webhook call failed:", err);
        setError(ERROR_MESSAGE);
        lockRef.current = false;
        setLoading(false);
      }
    },
    [sessionId, successUrl, cancelUrl, paymentMethod],
  );

  return { pay, loading, error };
}
