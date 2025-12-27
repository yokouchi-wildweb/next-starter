// src/components/Theme/DarkModeSwitch.tsx

"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useMemo } from "react";
import { HeadPortal } from "@/components/Fanctional/HeadPortal";
import { useSiteThemeStore } from "@/stores/siteTheme";
import { Button } from "@/components/Form/Button/Button";

const themeBootstrapCode = `
  (function() {
    try {
      var root = document.documentElement;
      var theme = localStorage.getItem('theme');

      if (theme === 'dark') {
        root.classList.add('dark');
        return;
      }

      if (theme === 'light') {
        root.classList.remove('dark');
        return;
      }

      // 初回アクセス時はライトモードをデフォルトにする
      root.classList.remove('dark');
    } catch (error) {
      // fail silently, theme will fall back to light
    }
  })();
`;

function ThemeInitializer() {
  return (
    <HeadPortal>
      <script dangerouslySetInnerHTML={{ __html: themeBootstrapCode }} />
    </HeadPortal>
  );
}

export function DarkModeSwitch({ className }: { className?: string }) {
  const { isDark, toggle } = useSiteThemeStore();

  const label = useMemo(
    () => (isDark ? "Switch to light mode" : "Switch to dark mode"),
    [isDark],
  );

  return (
    <>
      <ThemeInitializer />
      <Button
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-pressed={isDark}
        variant="outline"
        size="icon"
        className={className}
      >
        {/* show correct icon based on the current html class to avoid hydration mismatches */}
        <SunIcon className="hidden size-4 dark:block" />
        <MoonIcon className="size-4 dark:hidden" />
      </Button>
    </>
  );
}
