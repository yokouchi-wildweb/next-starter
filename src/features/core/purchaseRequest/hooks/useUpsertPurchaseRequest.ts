// src/features/purchaseRequest/hooks/useUpsertPurchaseRequest.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { purchaseRequestClient } from "../services/client/purchaseRequestClient";
import type { PurchaseRequest } from "../entities";
import type { PurchaseRequestCreateFields } from "../entities/form";

export const useUpsertPurchaseRequest = () => {
  const upsert = purchaseRequestClient.upsert;

  if (!upsert) {
    throw new Error("PurchaseRequestのアップサート機能が利用できません");
  }

  return useUpsertDomain<PurchaseRequest, PurchaseRequestCreateFields>(
    "purchaseRequests/upsert",
    upsert,
    "purchaseRequests",
  );
};
