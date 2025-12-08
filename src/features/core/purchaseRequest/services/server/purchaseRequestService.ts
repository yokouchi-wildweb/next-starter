// src/features/purchaseRequest/services/server/purchaseRequestService.ts

import { base } from "./drizzleBase";
import {
  initiatePurchase,
  getPurchaseStatus,
  getPurchaseStatusForUser,
  completePurchase,
  failPurchase,
  expirePendingRequests,
} from "./wrappers/purchaseService";

export const purchaseRequestService = {
  ...base,
  // 購入フロー固有のメソッド
  initiatePurchase,
  getPurchaseStatus,
  getPurchaseStatusForUser,
  completePurchase,
  failPurchase,
  expirePendingRequests,
};

// 型のエクスポート
export type {
  InitiatePurchaseParams,
  InitiatePurchaseResult,
  CompletePurchaseParams,
  CompletePurchaseResult,
  FailPurchaseParams,
} from "./wrappers/purchaseService";
