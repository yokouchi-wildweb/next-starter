// src/domains/purchaseRequest/services/server/purchaseRequestService.ts

import { purchaseRequestBase } from "./purchaseRequestBase";
import {
  initiatePurchase,
  getPurchaseStatus,
  getPurchaseStatusForUser,
  completePurchase,
  failPurchase,
  cancelPurchase,
  handleWebhook,
  expirePendingRequests,
} from "./wrappers/purchaseService";
import { recordBankTransferJudgment } from "./wrappers/recordBankTransferJudgment";

export const purchaseRequestService = {
  ...purchaseRequestBase,
  // 購入フロー固有のメソッド
  initiatePurchase,
  getPurchaseStatus,
  getPurchaseStatusForUser,
  completePurchase,
  failPurchase,
  cancelPurchase,
  handleWebhook,
  expirePendingRequests,
  recordBankTransferJudgment,
};

// 型のエクスポート
export type {
  InitiatePurchaseParams,
  InitiatePurchaseResult,
  CompletePurchaseParams,
  CompletePurchaseResult,
  FailPurchaseParams,
  CancelPurchaseParams,
  CancelPurchaseResult,
  HandleWebhookParams,
  HandleWebhookResult,
} from "./wrappers/purchaseService";
