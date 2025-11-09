// src/features/cardRarity/hooks/useCardRarities.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { cardRarityClient } from "../services/client/cardRarityClient";
import type { CardRarity } from "../entities";
import type { SWRConfiguration } from "swr";

export const useCardRarities = (config?: SWRConfiguration) =>
  useDomainList<CardRarity>("cardRarities", cardRarityClient.getAll, config);
