// src/domains/purchaseRequest/services/client/purchaseRequestClient.ts

import axios from "axios";
import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud";
import type { PurchaseRequest } from "@/domains/core/purchaseRequest/entities";
import type {
  PurchaseRequestCreateFields,
  PurchaseRequestUpdateFields,
} from "@/domains/core/purchaseRequest/entities/form";
import { normalizeHttpError } from "@/lib/errors";
import type { PersistedMilestoneResult } from "@/domains/core/milestone/types/milestone";
import type { LaunchInstruction } from "@/domains/core/purchaseRequest/types/payment";
import type { JudgmentResult } from "@/domains/core/purchaseRequest/types/bankTransferJudgment";

// 基本CRUDクライアント
export const purchaseRequestClient: ApiClient<
  PurchaseRequest,
  PurchaseRequestCreateFields,
  PurchaseRequestUpdateFields
> = createApiClient<
  PurchaseRequest,
  PurchaseRequestCreateFields,
  PurchaseRequestUpdateFields
>("/api/purchaseRequest");

// ============================================================================
// 購入フロー用カスタムメソッド
// ============================================================================

/**
 * 購入ステータスレスポンス
 */
export type PurchaseStatusResponse = {
  id: string;
  status: string;
  walletType: string;
  amount: number;
  paymentAmount: number;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  /** マイルストーン評価結果（購入完了時に達成されたもの） */
  milestoneResults?: PersistedMilestoneResult[] | null;
};

/**
 * 購入ステータスを取得
 */
export async function getPurchaseStatus(requestId: string): Promise<PurchaseStatusResponse> {
  try {
    const res = await axios.get<PurchaseStatusResponse>(
      `/api/wallet/purchase/${requestId}/status`
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "ステータスの取得に失敗しました");
  }
}

/**
 * 購入開始リクエスト
 */
export type InitiatePurchaseRequest = {
  idempotencyKey: string;
  walletType: string;
  amount: number;
  paymentAmount: number;
  /**
   * ユーザーが選択した支払い方法 ID（purchaseRequest の config.ts の payment. paymentMethods[i].id と一致）。
   * 例: "credit_card", "convenience_store", "bank_transfer"
   * サーバー側で provider 解決 (resolveProviderForMethod) に使用される。
   */
  paymentMethod: string;
  /** 商品名（決済ページに表示） */
  itemName?: string;
  /** クーポンコード（割引適用時） */
  couponCode?: string;
};

/**
 * 購入開始レスポンス
 *
 * instruction はクライアントへの起動指示。useCoinPurchase が executePaymentLaunch
 * 経由で type に応じてリダイレクト or SDK 起動を行う。
 * successUrl / cancelUrl は SDK 型完了後のクライアント側遷移先として使用する。
 */
export type InitiatePurchaseResponse = {
  success: boolean;
  requestId: string;
  instruction: LaunchInstruction;
  successUrl: string;
  cancelUrl: string;
  alreadyProcessing?: boolean;
  alreadyCompleted?: boolean;
};

/**
 * 購入を開始
 */
export async function initiatePurchase(
  params: InitiatePurchaseRequest
): Promise<InitiatePurchaseResponse> {
  try {
    const res = await axios.post<InitiatePurchaseResponse>(
      "/api/wallet/purchase/initiate",
      params
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "購入処理の開始に失敗しました");
  }
}

// ============================================================================
// 進行中の購入リクエストをユーザー自身がキャンセル
// ============================================================================

/**
 * 購入キャンセルのレスポンス
 *
 * サーバーは status を expired に変更し、関連する bank_transfer_review があれば
 * rejected に遷移させる。redirectUrl は決済方法選択画面（同一の amount / price）への
 * リダイレクト URL を想定。
 */
export type CancelPurchaseResponse = {
  success: boolean;
  requestId: string;
  /** 決済方法選択画面 (/wallet/[slug]/purchase?amount=...&price=...) への遷移先 */
  redirectUrl: string;
};

/**
 * 自分の進行中の購入リクエストをキャンセルする。
 * 主な用途: 銀行振込の案内画面から「キャンセル」ボタンで購入をやり直す。
 *
 * サーバー側で:
 * - 認可（user_id 一致）
 * - status が pending / processing のときのみ受け付け（completed 等は 400）
 * - status を expired に変更
 * - 関連 bank_transfer_review が pending_review なら rejected に変更
 * - redirectUrl で決済方法選択画面に戻す
 */
export async function cancelPurchase(
  requestId: string,
): Promise<CancelPurchaseResponse> {
  try {
    const res = await axios.post<CancelPurchaseResponse>(
      `/api/wallet/purchase/${requestId}/cancel`,
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "キャンセル処理に失敗しました");
  }
}

/**
 * 振込明細画像を AI の事前判定に送る(合否はサーバーが確定して返す)。
 * 失敗は HttpError で投げる。429(判定の回数制限)は responseData.rateLimit に残量が載る。
 */
export async function judgeBankTransferImage(
  requestId: string,
  file: File,
): Promise<JudgmentResult> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await axios.post<JudgmentResult>(
      `/api/wallet/purchase/${requestId}/bank-transfer/judge-image`,
      formData,
    );
    return res.data;
  } catch (error) {
    throw normalizeHttpError(error, "判定に失敗しました");
  }
}

/**
 * ダミー決済の結果をダミーの webhook に知らせる(開発・デモ用の決済プロバイダ)。
 * payment_method は利用者が選んだ方法をそのまま伝える(未指定ならサーバー側で credit_card)。
 */
export async function notifyDummyPayment(input: {
  success: boolean;
  sessionId: string;
  paymentMethod?: string | null;
}): Promise<void> {
  try {
    await axios.post("/api/webhook/payment?provider=dummy", {
      event_type: input.success ? "payment.completed" : "payment.failed",
      session_id: input.sessionId,
      payment_method: input.paymentMethod ?? undefined,
    });
  } catch (error) {
    throw normalizeHttpError(error, "決済処理中にエラーが発生しました。");
  }
}
