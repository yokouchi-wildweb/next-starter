// src/features/core/purchaseQuota/entities/schema.ts

import { z } from "zod";

import { PURCHASE_QUOTA_LEDGER_STATUSES } from "@/features/core/purchaseQuota/constants";

export const PurchaseQuotaLedgerBaseSchema = z.object({
  user_id: z.string().min(1),
  payment_method: z.string().min(1),
  amount: z.number().int().nonnegative(),
  purchase_request_id: z.string().min(1),
  status: z.enum(PURCHASE_QUOTA_LEDGER_STATUSES),
});

export const PurchaseQuotaLedgerCreateSchema = PurchaseQuotaLedgerBaseSchema;
export const PurchaseQuotaLedgerUpdateSchema =
  PurchaseQuotaLedgerBaseSchema.partial();
