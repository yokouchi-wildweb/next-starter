// src/features/core/purchaseRequest/hooks/useCoinPurchase.ts

"use client";

import { useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { initiatePurchase } from "../services/client/purchaseRequestClient";
import { err } from "@/lib/errors/httpError";
import { CURRENCY_CONFIG, type WalletType } from "@/config/app/currency.config";

// CURRENCY_CONFIG の最初のキーをデフォルト値として使用
const defaultWalletType = Object.keys(CURRENCY_CONFIG)[0] as WalletType;

type UseCoinPurchaseParams = {
  walletType?: WalletType;
  amount: number;
  paymentAmount: number;
};

type UseCoinPurchaseResult = {
  /** 購入処理を開始（決済方法はリダイレクト先で選択） */
  purchase: () => Promise<void>;
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
  walletType = defaultWalletType,
  amount,
  paymentAmount,
}: UseCoinPurchaseParams): UseCoinPurchaseResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchase = useCallback(
    async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 冪等キーを生成
        const idempotencyKey = uuidv4();

        // 購入開始APIを呼び出し
        // paymentMethod は決済プロバイダ側で選択されるため、初期値として "redirect" を設定
        // 実際の決済方法はWebhook受信時に上書きされる
        const result = await initiatePurchase({
          idempotencyKey,
          walletType,
          amount,
          paymentAmount,
          paymentMethod: "redirect",
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
