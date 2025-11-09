// src/stores/useSiteThemeStore.ts

"use client";

import { create } from "zustand";
import { getInitialTheme } from "@/utils/siteTheme";

type ThemeState = {
  isDark: boolean;
  setDark: (d: boolean) => void;
  toggleDark: () => void;
};

export const useSiteThemeStore = create<ThemeState>((set) => ({
  // read the persisted or system preference on the client
  isDark: getInitialTheme(),
  setDark: (d) => set({ isDark: d }),
  toggleDark: () => set((state) => ({ isDark: !state.isDark })),
}));
