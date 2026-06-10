// src/features/core/purchaseRequest/hooks/useCoinPurchase.ts

"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { initiatePurchase } from "../services/client/purchaseRequestClient";
import { executePaymentLaunch } from "../services/client/launchers";
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

  // 冪等キーは「購入 intent（支払い方法・ウォレット・金額）」が変わるたびに発番し直す。
  // - 同一 intent での二重クリック/再レンダーでは同じキー（メモ化）＝二重送信防止。
  // - 支払い方法や金額を切り替えると別キー＝別 purchase_request になり、別 provider の
  //   processing を掴む不具合（モーダルを閉じて別方法を選ぶと結果画面へ直行）を構造的に防ぐ。
  // - クーポン変更ではキーを変えない（pending を再利用して金額更新するため deps に含めない）。
  // idempotency_key カラムが uuid 型のため intent を直接キーに焼き込めず、deps 変化をトリガに
  // uuidv4 を再生成する（uuid のランダム性が冪等キーの予測不能性も担保する）。
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps は再生成トリガで callback では未参照
  const idempotencyKey = useMemo(() => uuidv4(), [paymentMethod, walletType, amount, paymentAmount]);

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
        // 該当プロバイダの起動指示 (LaunchInstruction) が返る。
        const result = await initiatePurchase({
          idempotencyKey,
          walletType,
          amount,
          paymentAmount,
          paymentMethod,
          itemName,
          couponCode: couponCode || undefined,
        });

        // LaunchInstruction を起動レイヤに委譲。
        // - redirect 型: window.location.href にリダイレクト URL を代入（ページ遷移）
        // - client_sdk 型: SDK モーダル起動 → 完了 → 確定 API → successUrl 遷移
        const launchResult = await executePaymentLaunch(result.instruction, {
          purchaseRequestId: result.requestId,
          successUrl: result.successUrl,
          cancelUrl: result.cancelUrl,
        });

        // redirected / completed では既に遷移済 or 遷移中。
        // closed / rejected / failed は呼び元のリトライ余地を残すためロックを解除する。
        if (launchResult.kind === "closed") {
          lockRef.current = false;
          setIsLoading(false);
        } else if (launchResult.kind === "rejected") {
          setError(launchResult.reason ?? "決済が拒否されました");
          lockRef.current = false;
          setIsLoading(false);
        } else if (launchResult.kind === "failed") {
          setError(launchResult.error.message);
          lockRef.current = false;
          setIsLoading(false);
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
