// stores/siteTheme/internalStore.ts

"use client";

import { create } from "zustand";

type ThemeState = {
  /** 現在ダークか。初期値は SSR と一致させるため false 固定(SiteThemeSync がマウント後に同期する) */
  isDark: boolean;
  /** 現在のエリア key(<html data-area>) */
  areaKey: string | null;
  /** SiteThemeSync が一度でも解決したか */
  synced: boolean;
  setResolved: (next: { isDark: boolean; areaKey: string }) => void;
  setDark: (isDark: boolean) => void;
};

export const internalStore = create<ThemeState>((set) => ({
  isDark: false,
  areaKey: null,
  synced: false,
  setResolved: ({ isDark, areaKey }) => set({ isDark, areaKey, synced: true }),
  setDark: (isDark) => set({ isDark }),
}));
