// src/features/cardTag/services/client/cardTagClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { CardTag } from "@/features/cardTag/entities";
import type { CardTagCreateFields } from "@/features/cardTag/entities/form";

export const cardTagClient: ApiClient<CardTag, CardTagCreateFields> = createApiClient<CardTag, CardTagCreateFields>("/api/cardTag");
