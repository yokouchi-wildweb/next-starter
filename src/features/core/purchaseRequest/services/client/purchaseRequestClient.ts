// src/features/purchaseRequest/services/client/purchaseRequestClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { PurchaseRequest } from "@/features/core/purchaseRequest/entities";
import type {
  PurchaseRequestCreateFields,
  PurchaseRequestUpdateFields,
} from "@/features/core/purchaseRequest/entities/form";

export const purchaseRequestClient: ApiClient<
  PurchaseRequest,
  PurchaseRequestCreateFields,
  PurchaseRequestUpdateFields
> = createApiClient<
  PurchaseRequest,
  PurchaseRequestCreateFields,
  PurchaseRequestUpdateFields
>("/api/purchaseRequest");
