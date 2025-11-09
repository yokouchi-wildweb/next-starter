// src/features/card/services/client/cardClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { Card } from "@/features/card/entities";
import type {
  CardCreateFields,
  CardUpdateFields,
} from "@/features/card/entities/form";

export const cardClient: ApiClient<Card, CardCreateFields, CardUpdateFields> =
  createApiClient<Card, CardCreateFields, CardUpdateFields>("/api/card");
