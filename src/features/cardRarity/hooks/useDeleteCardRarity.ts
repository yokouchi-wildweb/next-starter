// src/features/cardRarity/hooks/useDeleteCardRarity.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { cardRarityClient } from "../services/client/cardRarityClient";

export const useDeleteCardRarity = () =>
  useDeleteDomain("cardRarities/delete", cardRarityClient.delete, "cardRarities");
