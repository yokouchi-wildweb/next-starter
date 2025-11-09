// src/features/card/hooks/useCards.ts

"use client";
import { useDomainList } from "@/lib/crud/hooks";
import { cardClient } from "../services/client/cardClient";
import type { Card } from "../entities";

export const useCards = () => useDomainList<Card>("cards", cardClient.getAll);
