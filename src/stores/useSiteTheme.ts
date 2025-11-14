// src/stores/useSiteTheme.ts

"use client";

import { useEffect } from "react";
import { useSiteThemeStore } from "@/stores/useSiteThemeStore";
import { applyTheme, getInitialTheme } from "@/utils/siteTheme";

export function useSiteTheme() {
  const isDark = useSiteThemeStore((s) => s.isDark);
  const setDark = useSiteThemeStore((s) => s.setDark);
  const toggleDark = useSiteThemeStore((s) => s.toggleDark);

  useEffect(() => {
    const initial = getInitialTheme();
    setDark(initial);
  }, [setDark]);

  useEffect(() => {
    applyTheme(isDark);
  }, [isDark]);

  return { isDark, toggle: toggleDark };
}
