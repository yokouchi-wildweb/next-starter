// src/features/card/hooks/useCard.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { cardClient } from "../services/client/cardClient";
import type { CardWithRelations } from "../entities";

export const useCard = (id?: string | null) =>
  useDomain<CardWithRelations | undefined>(
    id ? `card:${id}` : null,
    () => cardClient.getById(id!) as Promise<CardWithRelations>,
  );
