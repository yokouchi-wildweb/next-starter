// src/features/core/purchaseQuota/entities/form.ts

import { z } from "zod";

import {
  PurchaseQuotaLedgerCreateSchema,
  PurchaseQuotaLedgerUpdateSchema,
} from "./schema";

export type PurchaseQuotaLedgerCreateFields = z.infer<
  typeof PurchaseQuotaLedgerCreateSchema
>;
export type PurchaseQuotaLedgerUpdateFields = z.infer<
  typeof PurchaseQuotaLedgerUpdateSchema
>;
