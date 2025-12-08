// src/features/core/purchaseRequest/hooks/useCoinPurchase.ts

"use client";

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { initiatePurchase } from "../services/client/purchaseRequestClient";
import { err } from "@/lib/errors/httpError";

type UseCoinPurchaseParams = {
  walletType?: string;
  amount: number;
  paymentAmount: number;
};

type UseCoinPurchaseResult = {
  /** 購入処理を開始 */
  purchase: (paymentMethod: string) => Promise<void>;
  /** 処理中かどうか */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
};

/**
 * コイン購入を開始するフック
 * 決済ページへのリダイレクトまでを処理
 */
export function useCoinPurchase({
  walletType = "regular_coin",
  amount,
  paymentAmount,
}: UseCoinPurchaseParams): UseCoinPurchaseResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchase = useCallback(
    async (paymentMethod: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // 冪等キーを生成
        const idempotencyKey = uuidv4();

        // 購入開始APIを呼び出し
        const result = await initiatePurchase({
          idempotencyKey,
          walletType,
          amount,
          paymentAmount,
          paymentMethod,
        });

        // 決済ページへリダイレクト
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
        }
      } catch (e) {
        const message = err(e, "購入処理の開始に失敗しました");
        setError(message);
        setIsLoading(false);
      }
    },
    [walletType, amount, paymentAmount]
  );

  return { purchase, isLoading, error };
}
