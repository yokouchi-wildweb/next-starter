// src/features/core/purchaseQuota/entities/model.ts

import type { PurchaseQuotaLedgerStatus } from "@/features/core/purchaseQuota/constants";

/**
 * 購入クォータ台帳の 1 レコード。
 */
export type PurchaseQuotaLedger = {
  id: string;
  user_id: string;
  payment_method: string;
  amount: number;
  purchase_request_id: string;
  status: PurchaseQuotaLedgerStatus;
  created_at: Date;
  updated_at: Date;
};
