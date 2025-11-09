// src/stores/useGachaResultStore.ts

"use client";

import { create } from "zustand";
import type { CardWithNames } from "@/features/card/entities";

export type GachaResultState = {
  cards: CardWithNames[] | null;
  setCards: (cards: CardWithNames[]) => void;
  clear: () => void;
};

export const useGachaResultStore = create<GachaResultState>((set) => ({
  cards: null,
  setCards: (cards) => set({ cards }),
  clear: () => set({ cards: null }),
}));
