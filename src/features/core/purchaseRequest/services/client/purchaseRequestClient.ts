// src/features/purchaseRequest/services/client/purchaseRequestClient.ts

import axios from "axios";
import { createApiClient } from "@/lib/crud";
import type { ApiClient } from "@/lib/crud/types";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities";
import type {
  PurchaseRequestCreateFields,
  PurchaseRequestUpdateFields,
} from "@/features/core/purchaseRequest/entities/form";
import { normalizeHttpError } from "@/lib/errors/httpError";
import type { PersistedMilestoneResult } from "@/features/core/milestone/types/milestone";

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
   * ユーザーが選択した支払い方法 ID（payment.config.ts の paymentMethods[i].id と一致）。
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
 */
export type InitiatePurchaseResponse = {
  success: boolean;
  requestId: string;
  redirectUrl: string;
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

