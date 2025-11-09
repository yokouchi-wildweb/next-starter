// src/features/card/hooks/useCreateCard.ts

"use client";
import { useCreateDomain } from "@/lib/crud/hooks";
import { cardClient } from "../services/client/cardClient";
import type { Card } from "../entities";
import type { CardCreateFields } from "../entities/form";

export const useCreateCard = () =>
  useCreateDomain<Card, CardCreateFields>("cards/create", cardClient.create, "cards");
