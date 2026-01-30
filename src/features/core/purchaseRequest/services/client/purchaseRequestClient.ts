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
  paymentMethod: string;
  /** 商品名（決済ページに表示） */
  itemName?: string;
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
