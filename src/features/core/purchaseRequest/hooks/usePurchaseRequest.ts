// src/features/purchaseRequest/hooks/usePurchaseRequest.ts

"use client";

import { useDomain } from "@/lib/crud";
import { purchaseRequestClient } from "../services/client/purchaseRequestClient";
import type { PurchaseRequest } from "../entities";

export const usePurchaseRequest = (id?: string | null) =>
  useDomain<PurchaseRequest | undefined>(
    id ? `purchaseRequest:${id}` : null,
    () => purchaseRequestClient.get(id!) as Promise<PurchaseRequest>,
  );
