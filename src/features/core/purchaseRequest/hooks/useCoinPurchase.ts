// src/features/core/purchaseRequest/hooks/useCoinPurchase.ts

"use client";

import { useState, useCallback, useMemo, useRef } from "react";
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
  /**
   * ユーザーが選択した支払い方法 ID。
   * payment.config.ts の paymentMethods[i].id と一致する値（"credit_card" 等）。
   * サーバー側で provider 解決に使用されるため、UI 上で選択された値を必ず渡すこと。
   */
  paymentMethod: string;
  /** 商品名（決済ページに表示） */
  itemName?: string;
  /** クーポンコード（割引適用時） */
  couponCode?: string;
};

type UseCoinPurchaseResult = {
  /** 購入処理を開始し、選択された支払い方法に対応するプロバイダ画面へリダイレクトする */
  purchase: () => Promise<void>;
  /** 処理中かどうか */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
};

/**
 * コイン購入を開始するフック
 * 選択された支払い方法に対応するプロバイダの決済ページへのリダイレクトまでを処理する
 */
export function useCoinPurchase({
  walletType = defaultWalletType,
  amount,
  paymentAmount,
  paymentMethod,
  itemName,
  couponCode,
}: UseCoinPurchaseParams): UseCoinPurchaseResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lockRef = useRef(false);

  // 冪等キーはコンポーネントのマウント時に1回だけ生成
  // 同一ページ上での二重クリックやクーポン変更後の再試行で同じキーを使い回す
  const idempotencyKey = useMemo(() => uuidv4(), []);

  const purchase = useCallback(
    async () => {
      if (lockRef.current) return;
      lockRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        // 購入開始 API を呼び出し
        // paymentMethod はユーザーが選択した値をそのまま送る。
        // サーバー側で resolveProviderForMethod により担当プロバイダが解決され、
        // 該当プロバイダの決済画面 URL が redirectUrl として返る。
        const result = await initiatePurchase({
          idempotencyKey,
          walletType,
          amount,
          paymentAmount,
          paymentMethod,
          itemName,
          couponCode: couponCode || undefined,
        });

        // 決済ページへリダイレクト
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
        }
      } catch (e) {
        const message = err(e, "購入処理の開始に失敗しました");
        setError(message);
        lockRef.current = false;
        setIsLoading(false);
      }
    },
    [idempotencyKey, walletType, amount, paymentAmount, paymentMethod, itemName, couponCode]
  );

  return { purchase, isLoading, error };
}
