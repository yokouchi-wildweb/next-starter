// src/features/cardRarity/hooks/useCreateCardRarity.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { cardRarityClient } from "../services/client/cardRarityClient";
import type { CardRarity } from "../entities";
import type { CardRarityCreateFields } from "../entities/form";

export const useCreateCardRarity = () =>
  useCreateDomain<CardRarity, CardRarityCreateFields>("cardRarities/create", cardRarityClient.create, "cardRarities");
