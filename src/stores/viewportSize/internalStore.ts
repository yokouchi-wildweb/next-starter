// stores/viewportSize/internalStore.ts

"use client";

import { create } from "zustand";

export type ViewportSizeState = {
  width: number;
  height: number;
  setSize: (width: number, height: number) => void;
};

export const internalStore = create<ViewportSizeState>((set) => ({
  width: 0,
  height: 0,
  setSize: (width, height) => set({ width, height }),
}));
