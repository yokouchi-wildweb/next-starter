// src/features/cardRarity/services/client/cardRarityClient.ts

import { createApiClient } from "@/lib/crud/apiClientFactory";
import type { ApiClient } from "@/lib/crud/types";
import type { CardRarity } from "@/features/cardRarity/entities";
import type { CardRarityCreateFields } from "@/features/cardRarity/entities/form";

export const cardRarityClient: ApiClient<CardRarity, CardRarityCreateFields> =
  createApiClient<CardRarity, CardRarityCreateFields>("/api/cardRarity");
