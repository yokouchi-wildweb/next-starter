// src/domains/core/purchaseRequest/services/server/wrappers/purchaseService.ts
// 購入フローの re-export ハブ
// 各機能は個別ファイルに分割済み。外部からの import パスを維持するためのエントリポイント。

import type { PaymentProviderName } from "../payment";
import type { WalletTypeValue } from "@/domains/core/wallet/types/field";
import type { PersistedMilestoneResult } from "@/domains/core/milestone/types/milestone";
import type { PurchaseRequest } from "@/domains/core/purchaseRequest/entities/model";
import type { PurchaseTypeKey } from "@/domains/purchaseRequest/config";
import type { LaunchInstruction } from "@/domains/core/purchaseRequest/types/payment";


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
   * 決済成功時のコールバック URL（optional・最優先）
   * 指定された場合は戦略の buildCallbackUrls やデフォルト URL より優先して使用される。
   * A/B テスト・マルチテナント・動的ページ遷移等の用途向け。
   * 未指定時は戦略の buildCallbackUrls → wallet-based デフォルトの順でフォールバック。
   */
  successUrl?: string;
  /**
   * 決済キャンセル時のコールバック URL（optional・最優先）
   * successUrl と同様のフォールバック順。
   */
  cancelUrl?: string;
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
  /**
   * クライアントへの起動指示。type に応じてリダイレクト or SDK 起動が走る。
   * 既存呼び出し側は executePaymentLaunch(instruction) を経由して使用する。
   */
  instruction: LaunchInstruction;
  /**
   * 決済成功時にクライアントが遷移すべき URL。
   * - redirect 型では provider 側に渡され、provider 側から自動で戻される (クライアント不要)。
   * - client_sdk 型では SDK 完了 + 確定 API 成功後にクライアント自身が遷移する。
   */
  successUrl: string;
  /**
   * 決済キャンセル / 失敗時にクライアントが遷移すべき URL。
   * 用途は successUrl と同じく、redirect / client_sdk 両方の戻り先として使う。
   */
  cancelUrl: string;
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
  /**
   * 決済プロバイダ名。
   * Webhook URL の `?provider=<name>` クエリ由来で決定される。
   * route.ts 側でクエリ未指定時は 400 を返すため、handler 到達時点で必ず確定している。
   */
  providerName: PaymentProviderName;
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
export { cancelPurchase } from "./cancelPurchase";
export type { CancelPurchaseParams, CancelPurchaseResult } from "./cancelPurchase";
export { handleWebhook } from "./webhookHandler";
export { expirePendingRequests } from "./purchaseHelpers";
export { settleExpiredClientSdkSessions } from "./expireStaleSessions";
export type { SettleExpiredClientSdkSessionsResult, StaleSessionOutcome } from "./expireStaleSessions";

// ステータス取得（ポーリング用）— 小規模なので inline で維持
import { base } from "../drizzleBase";
import type { PurchaseRequest as PR } from "@/domains/core/purchaseRequest/entities/model";
import { reconcileWithProvider } from "./reconcileWithProvider";

/**
 * 購入リクエストのステータスを取得
 */
export async function getPurchaseStatus(requestId: string): Promise<PR | null> {
  const result = await base.get(requestId);
  return result as PR | null;
}

/**
 * ユーザーIDとリクエストIDで購入リクエストを取得（認可チェック用）
 * processing の場合、決済プロバイダの状態と照らして DB を更新する(reconcileWithProvider)
 */
export async function getPurchaseStatusForUser(
  requestId: string,
  userId: string
): Promise<PR | null> {
  const request = await base.get(requestId) as PR | null;
  if (!request || request.user_id !== userId) {
    return null;
  }

  // processing の場合、プロバイダの状態と照らす(reconcileWithProvider。未確定ならそのまま返す)
  if (request.status === "processing") {
    try {
      return (await reconcileWithProvider(request)).request;
    } catch (error) {
      console.error("[getPurchaseStatusForUser] Provider status check failed:", error);
      // エラー時は現在のステータスをそのまま返す
    }
  }

  return request;
}
