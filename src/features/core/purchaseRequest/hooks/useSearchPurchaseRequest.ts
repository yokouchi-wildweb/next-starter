// src/features/purchaseRequest/hooks/useSearchPurchaseRequest.ts

"use client";

import { useSearchDomain } from "@/lib/crud/hooks";
import { purchaseRequestClient } from "../services/client/purchaseRequestClient";
import type { PurchaseRequest } from "../entities";
import type { SearchParams } from "@/lib/crud/types";

export type PurchaseRequestSearchParams = NonNullable<typeof purchaseRequestClient.search> extends (
  params: infer P,
) => Promise<unknown>
  ? P
  : SearchParams;

export const useSearchPurchaseRequest = (params: PurchaseRequestSearchParams) => {
  const search = purchaseRequestClient.search;

  if (!search) {
    throw new Error("PurchaseRequestの検索機能が利用できません");
  }

  return useSearchDomain<PurchaseRequest, PurchaseRequestSearchParams>(
    "purchaseRequests/search",
    search,
    params,
  );
};
