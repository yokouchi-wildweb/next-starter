// src/features/card/hooks/useUpdateCard.ts

"use client";
import { useUpdateDomain } from "@/lib/crud/hooks";
import { cardClient } from "../services/client/cardClient";
import type { Card } from "../entities";
import type { CardUpdateFields } from "../entities/form";

export const useUpdateCard = () =>
  useUpdateDomain<Card, CardUpdateFields>(
    "cards/update",
    cardClient.update,
    "cards",
  );
