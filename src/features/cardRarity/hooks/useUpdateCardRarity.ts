// src/features/cardRarity/hooks/useUpdateCardRarity.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { cardRarityClient } from "../services/client/cardRarityClient";
import type { CardRarity } from "../entities";

export const useUpdateCardRarity = () =>
  useUpdateDomain<CardRarity>("cardRarities/update", cardRarityClient.update, "cardRarities");
