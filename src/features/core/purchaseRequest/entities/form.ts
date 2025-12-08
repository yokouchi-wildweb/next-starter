// src/features/purchaseRequest/entities/form.ts

import { z } from "zod";
import { PurchaseRequestCreateSchema, PurchaseRequestUpdateSchema } from "./schema";

export type PurchaseRequestCreateAdditional = {
  // foo: string; フォームに追加する項目
};
export type PurchaseRequestCreateFields = z.infer<typeof PurchaseRequestCreateSchema> & PurchaseRequestCreateAdditional;

export type PurchaseRequestUpdateAdditional = {
  // foo: string; フォームに追加する項目
};
export type PurchaseRequestUpdateFields = z.infer<typeof PurchaseRequestUpdateSchema> & PurchaseRequestUpdateAdditional;
