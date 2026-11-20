// src/lib/siteTheme/useDarkModeSwitch.ts

"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { siteThemeConfig } from "./config";
import { resolveSiteThemeArea } from "./resolve";
import { useSiteThemeStore } from "./stores";

/**
 * ライト / ダーク切替ボタンが描くための状態と操作。ボタンの見た目は使う側(例: 管理のヘッダー)が持つ。
 * - switchable: 現在のパスが属するエリアが切替可か。usePathname から決めるので SSR とクライアントで一致し、
 *   SiteThemeSync の同期の前(store の areaKey が null の間)もボタンが消えない(初回描画でヘッダーがずれない)
 * - isDark / toggle: store から。切替を拒む錠は store の areaKey 側にある(ロックされたエリアでは toggle は何もしない)
 */
export function useDarkModeSwitch() {
  const pathname = usePathname();
  const { isDark, toggle } = useSiteThemeStore();

  const switchable = useMemo(
    () => resolveSiteThemeArea(siteThemeConfig, pathname ?? "/").switchable,
    [pathname],
  );

  return { isDark, switchable, toggle };
}
