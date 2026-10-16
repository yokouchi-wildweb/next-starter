// src/components/Fanctional/DarkModeSwitch.tsx

"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/Form/Button/Button";
import { SITE_THEME_CONFIG } from "@/config/ui/site-theme.config";
import { resolveSiteThemeArea } from "@/lib/siteTheme";
import { useSiteThemeStore } from "@/stores/siteTheme";

/**
 * ライト / ダーク切替ボタン。
 * 現在のパスが属するエリアが switchable でなければ何も描画しない
 * (表示可否は usePathname ベースなので SSR とクライアントで一致し、hydration 差分が出ない)。
 * テーマの初期化は root layout の bootstrap script と SiteThemeSync が担うため、ここでは行わない。
 */
export function DarkModeSwitch({ className }: { className?: string }) {
  const pathname = usePathname();
  const { isDark, toggle } = useSiteThemeStore();

  const switchable = useMemo(
    () => resolveSiteThemeArea(SITE_THEME_CONFIG, pathname ?? "/").switchable,
    [pathname],
  );

  const label = useMemo(
    () => (isDark ? "Switch to light mode" : "Switch to dark mode"),
    [isDark],
  );

  if (!switchable) return null;

  return (
    <Button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isDark}
      variant="outline"
      size="icon"
      className={className}
    >
      {/* アイコンは html の dark クラスで切り替える(store 同期前でも表示が正しい) */}
      <SunIcon className="hidden size-4 dark:block" />
      <MoonIcon className="size-4 dark:hidden" />
    </Button>
  );
}
