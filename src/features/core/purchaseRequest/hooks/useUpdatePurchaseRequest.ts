// src/features/purchaseRequest/hooks/useUpdatePurchaseRequest.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { purchaseRequestClient } from "../services/client/purchaseRequestClient";
import type { PurchaseRequest } from "../entities";
import type { PurchaseRequestUpdateFields } from "../entities/form";

export const useUpdatePurchaseRequest = () =>
  useUpdateDomain<PurchaseRequest, PurchaseRequestUpdateFields>(
    "purchaseRequests/update",
    purchaseRequestClient.update,
    "purchaseRequests",
  );
