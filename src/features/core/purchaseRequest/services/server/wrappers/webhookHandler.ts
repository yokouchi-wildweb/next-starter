// src/features/core/purchaseRequest/services/server/wrappers/webhookHandler.ts
// Webhook処理

import {
  getPaymentProvider,
  getDefaultProviderName,
} from "../payment";
import { isDomainError } from "@/lib/errors/domainError";
import { completePurchase } from "./completePurchase";
import { failPurchase } from "./failPurchase";
import type { HandleWebhookParams, HandleWebhookResult } from "./purchaseService";

// ============================================================================
// Webhook処理
// ============================================================================

/**
 * Webhookを処理する
 * プロバイダ選択、検証、結果に応じた処理を一括で行う
 */
export async function handleWebhook(
  params: HandleWebhookParams
): Promise<HandleWebhookResult> {
  const { request, providerName = getDefaultProviderName(), webhookSignature } = params;

  // 1. プロバイダでWebhookを検証・パース
  const provider = getPaymentProvider(providerName);
  const paymentResult = await provider.verifyWebhook(request);

  // 2. 未確定ステータス（PENDING 等）は無視して 200 を返す
  // PaymentResult.status が "pending" の場合、または status 未指定かつ success=false でエラー情報がない場合
  if (paymentResult.status === "pending") {
    console.log(`[handleWebhook] 未確定ステータスのためスキップ: sessionId=${paymentResult.sessionId}`);
    return {
      success: true,
      requestId: "",
      message: "未確定ステータスのため処理をスキップしました。",
    };
  }

  // 3. 決済結果に応じて処理
  if (paymentResult.success) {
    // 決済成功 → 購入完了処理
    try {
      const result = await completePurchase({
        sessionId: paymentResult.sessionId,
        transactionId: paymentResult.transactionId,
        paymentMethod: paymentResult.paymentMethod,
        paidAt: paymentResult.paidAt,
        paidAmount: paymentResult.paidAmount,
        webhookSignature,
        providerName,
      });

      return {
        success: true,
        requestId: result.purchaseRequest.id,
        walletHistoryId: result.walletHistoryId,
        milestoneResults: result.milestoneResults,
        message: "購入が完了しました。",
      };
    } catch (error) {
      // DomainError（409: 楽観的ロック競合、400: 無効なステータス等）は
      // Webhookの正常応答として扱う（プロバイダーのリトライを防止）
      // それ以外（DB障害等）は re-throw してプロバイダーにリトライさせる
      if (isDomainError(error)) {
        console.warn("[handleWebhook] completePurchase DomainError:", error.message);
        return {
          success: true,
          requestId: "",
          message: "処理済みまたはスキップされました。",
        };
      }
      throw error;
    }
  } else {
    // 決済失敗 → 失敗処理
    try {
      const result = await failPurchase({
        sessionId: paymentResult.sessionId,
        errorCode: paymentResult.errorCode,
        errorMessage: paymentResult.errorMessage,
        providerName,
      });

      return {
        success: true, // Webhook処理自体は成功
        requestId: result.id,
        message: "決済失敗を記録しました。",
      };
    } catch (error) {
      if (isDomainError(error)) {
        console.warn("[handleWebhook] failPurchase DomainError:", error.message);
        return {
          success: true,
          requestId: "",
          message: "処理済みまたはスキップされました。",
        };
      }
      throw error;
    }
  }
}
