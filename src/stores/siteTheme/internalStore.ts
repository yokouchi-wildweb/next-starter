// stores/siteTheme/internalStore.ts

"use client";

import { create } from "zustand";
import { getInitialTheme } from "@/utils/siteTheme";

type ThemeState = {
  isDark: boolean;
  setDark: (d: boolean) => void;
  toggleDark: () => void;
};

export const internalStore = create<ThemeState>((set) => ({
  isDark: getInitialTheme(),
  setDark: (d) => set({ isDark: d }),
  toggleDark: () => set((state) => ({ isDark: !state.isDark })),
}));
