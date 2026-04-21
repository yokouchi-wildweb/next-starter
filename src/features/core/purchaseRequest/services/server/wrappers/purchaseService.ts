// src/features/core/purchaseRequest/services/server/wrappers/purchaseService.ts
// 購入フローの re-export ハブ
// 各機能は個別ファイルに分割済み。外部からの import パスを維持するためのエントリポイント。

import type { PaymentProviderName } from "../payment";
import type { WalletTypeValue } from "@/features/core/wallet/types/field";
import type { PersistedMilestoneResult } from "@/features/core/milestone/types/milestone";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities/model";
import type { PurchaseTypeKey } from "@/config/app/purchaseType.config";

// フック定義の副作用インポート（登録を実行）
import "../hooks/definitions";
// エンリッチャー定義の副作用インポート（登録を実行）
import "../payment/enrichers";
// 購入完了戦略の副作用インポート（ビルトイン wallet_topup の登録を実行）
import "../completion";

// ============================================================================
// 型定義
// ============================================================================

export type InitiatePurchaseParams = {
  userId: string;
  idempotencyKey: string;
  /**
   * 購入タイプ（履行形態）。省略時は "wallet_topup"（従来挙動）。
   * 下流プロジェクトで独自の購入タイプを使う場合は明示指定する。
   */
  purchaseType?: PurchaseTypeKey;
  /**
   * 加算対象のウォレット種別。
   * purchase_type=wallet_topup のときのみ必須。それ以外は null 可。
   */
  walletType?: WalletTypeValue | null;
  amount: number;
  paymentAmount: number;
  paymentMethod: string;
  paymentProvider?: PaymentProviderName;
  baseUrl: string;
  /** 商品名（決済ページに表示） */
  itemName?: string;
  /** クーポンコード（割引適用時） */
  couponCode?: string;
  /**
   * 下流プロジェクト向けの汎用メタデータ。
   * そのまま purchase_requests.metadata (JSONB) に保存され、
   * strategy.complete() から purchaseRequest.metadata として読み出せる。
   * purchase_type 固有の識別情報（例: directSaleId, planId）を格納する用途。
   * 冪等キー再利用時は上書きされる（古い metadata は残らない）。
   */
  metadata?: Record<string, unknown>;
  /** プロバイダ固有のオプション（決済セッション作成時にそのまま渡される） */
  providerOptions?: Record<string, unknown>;
};

export type InitiatePurchaseResult = {
  purchaseRequest: PurchaseRequest;
  redirectUrl: string;
  alreadyProcessing?: boolean;
  alreadyCompleted?: boolean;
};

export type CompletePurchaseParams = {
  sessionId: string;
  /** プロバイダ側の取引ID */
  transactionId?: string;
  /** 実際に使用された決済方法（Webhookから取得） */
  paymentMethod?: string;
  /** 支払い完了日時 */
  paidAt?: Date;
  /** プロバイダが実際に課金した金額（Webhookペイロードから取得、照合用） */
  paidAmount?: number;
  /** Webhook署名（デバッグ用） */
  webhookSignature?: string;
  /** 決済プロバイダ名（識別子解決に使用） */
  providerName?: PaymentProviderName;
};

export type CompletePurchaseResult = {
  purchaseRequest: PurchaseRequest;
  /**
   * ウォレット履歴ID
   * - wallet_topup 購入: 生成された WalletHistory の id
   * - ウォレット加算を伴わない購入（例: direct_sale）: null
   */
  walletHistoryId: string | null;
  /** マイルストーン評価結果（達成されたもののみ） */
  milestoneResults?: PersistedMilestoneResult[];
};

export type FailPurchaseParams = {
  sessionId: string;
  errorCode?: string;
  errorMessage?: string;
  /** 決済プロバイダ名（識別子解決に使用） */
  providerName?: PaymentProviderName;
};

export type HandleWebhookParams = {
  request: Request;
  providerName?: PaymentProviderName;
  /** Webhook署名（デバッグ用に記録） */
  webhookSignature?: string;
};

export type HandleWebhookResult = {
  success: boolean;
  requestId: string;
  /**
   * ウォレット履歴ID
   * - wallet_topup 購入: 生成された WalletHistory の id
   * - ウォレット加算を伴わない購入（例: direct_sale）: null
   * - 未確定や早期リターン: undefined
   */
  walletHistoryId?: string | null;
  /** マイルストーン評価結果（達成されたもののみ） */
  milestoneResults?: PersistedMilestoneResult[];
  message: string;
};

// ============================================================================
// 機能の re-export
// ============================================================================

export { initiatePurchase } from "./initiatePurchase";
export { completePurchase } from "./completePurchase";
export { failPurchase } from "./failPurchase";
export { handleWebhook } from "./webhookHandler";
export { expirePendingRequests } from "./purchaseHelpers";

// ステータス取得（ポーリング用）— 小規模なので inline で維持
import { base } from "../drizzleBase";
import type { PurchaseRequest as PR } from "@/features/core/purchaseRequest/entities/model";
import {
  getPaymentProvider,
  type PaymentProviderName as PPN,
} from "../payment";
import { completePurchase } from "./completePurchase";
import { failPurchase } from "./failPurchase";

/**
 * 購入リクエストのステータスを取得
 */
export async function getPurchaseStatus(requestId: string): Promise<PR | null> {
  const result = await base.get(requestId);
  return result as PR | null;
}

/**
 * ユーザーIDとリクエストIDで購入リクエストを取得（認可チェック用）
 * processingステータスの場合、決済プロバイダーにステータスを確認してDBを更新
 */
export async function getPurchaseStatusForUser(
  requestId: string,
  userId: string
): Promise<PR | null> {
  const request = await base.get(requestId) as PR | null;
  if (!request || request.user_id !== userId) {
    return null;
  }

  // processingの場合、プロバイダーにステータスを確認
  if (request.status === "processing" && request.payment_provider) {
    const providerName = request.payment_provider as PPN;
    try {
      const provider = getPaymentProvider(providerName);
      // getPaymentStatusはオプショナルなので、未実装の場合はスキップ
      if (!provider.getPaymentStatus) {
        return request;
      }

      // プロバイダ別に API 照会用の識別子を選択する。
      // - Fincode: provider_order_id（`GET /v1/payments/Card/{order_id}` の id 部分）
      // - Square 等: payment_session_id（既存の挙動）
      //
      // この識別子は findByWebhookIdentifier の照合キーとしてもそのまま使われるため、
      // completePurchase / failPurchase の sessionId にも同じ値を渡す必要がある。
      const identifier =
        providerName === "fincode"
          ? request.provider_order_id
          : request.payment_session_id;
      if (!identifier) {
        return request;
      }

      const providerStatus = await provider.getPaymentStatus(identifier);

      if (providerStatus.status === "completed") {
        // 決済完了 → DB更新
        const result = await completePurchase({
          sessionId: identifier,
          transactionId: providerStatus.transactionId,
          paidAt: providerStatus.paidAt,
          providerName,
        });
        return result.purchaseRequest;
      } else if (providerStatus.status === "failed" || providerStatus.status === "expired") {
        // 決済失敗/期限切れ → DB更新
        const result = await failPurchase({
          sessionId: identifier,
          errorCode: providerStatus.errorCode,
          errorMessage: providerStatus.errorMessage,
          providerName,
        });
        return result;
      }
      // pending/processing の場合はそのまま返す
    } catch (error) {
      console.error("[getPurchaseStatusForUser] Provider status check failed:", error);
      // エラー時は現在のステータスをそのまま返す
    }
  }

  return request;
}
