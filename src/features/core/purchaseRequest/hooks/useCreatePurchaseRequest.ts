// src/features/purchaseRequest/hooks/useCreatePurchaseRequest.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { purchaseRequestClient } from "../services/client/purchaseRequestClient";
import type { PurchaseRequest } from "../entities";
import type { PurchaseRequestCreateFields } from "../entities/form";

export const useCreatePurchaseRequest = () =>
  useCreateDomain<PurchaseRequest, PurchaseRequestCreateFields>("purchaseRequests/create", purchaseRequestClient.create, "purchaseRequests");
