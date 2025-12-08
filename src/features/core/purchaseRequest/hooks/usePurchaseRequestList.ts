// src/features/purchaseRequest/hooks/usePurchaseRequestList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { purchaseRequestClient } from "../services/client/purchaseRequestClient";
import type { PurchaseRequest } from "../entities";
import type { SWRConfiguration } from "swr";

export const usePurchaseRequestList = (config?: SWRConfiguration) =>
  useDomainList<PurchaseRequest>("purchaseRequests", purchaseRequestClient.getAll, config);
