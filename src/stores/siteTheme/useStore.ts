// stores/siteTheme/useStore.ts

"use client";

import { useEffect } from "react";
import { internalStore } from "./internalStore";
import { applyTheme, getInitialTheme } from "@/utils/siteTheme";

export function useSiteThemeStore() {
  const isDark = internalStore((s) => s.isDark);
  const setDark = internalStore((s) => s.setDark);
  const toggleDark = internalStore((s) => s.toggleDark);

  useEffect(() => {
    const initial = getInitialTheme();
    setDark(initial);
  }, [setDark]);

  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  return { isDark, toggle: toggleDark };
}
