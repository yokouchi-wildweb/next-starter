// src/features/purchaseRequest/hooks/useDeletePurchaseRequest.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { purchaseRequestClient } from "../services/client/purchaseRequestClient";

export const useDeletePurchaseRequest = () => useDeleteDomain("purchaseRequests/delete", purchaseRequestClient.delete, "purchaseRequests");
