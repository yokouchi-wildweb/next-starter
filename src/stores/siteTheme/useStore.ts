// stores/siteTheme/useStore.ts

"use client";

import { useCallback, useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

import { SITE_THEME_CONFIG } from "@/config/ui/site-theme.config";
import { getSiteThemeAreaByKey } from "@/lib/siteTheme";
import {
  applyThemeToDom,
  persistThemePreference,
  readThemeFromDom,
  resolveCurrentSiteTheme,
  subscribeSystemPrefersDark,
} from "@/utils/siteTheme";

import { internalStore } from "./internalStore";

/**
 * サイトテーマの状態と切替操作(DarkModeSwitch 等が使う)。
 * DOM への反映は useSiteThemeSync(root layout の SiteThemeSync が呼ぶ)が担うため、
 * ここでは状態更新と「利用者の選択の保存」だけを行う。
 * 現在のエリアが switchable でなければ setDark / toggle は何もしない(ロックの契約を UI 側に委ねない)。
 */
export function useSiteThemeStore() {
  const isDark = internalStore((s) => s.isDark);
  const areaKey = internalStore((s) => s.areaKey);
  const setDarkState = internalStore((s) => s.setDark);

  const switchable = getSiteThemeAreaByKey(SITE_THEME_CONFIG, areaKey).switchable;

  const setDark = useCallback(
    (next: boolean) => {
      if (!switchable) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[siteTheme] エリア "${areaKey ?? "?"}" は switchable ではないため setDark は無視されました`);
        }
        return;
      }
      setDarkState(next);
      persistThemePreference(next);
    },
    [switchable, areaKey, setDarkState],
  );

  // 同期前に押された場合でも DOM の実状態(bootstrap script が確定済み)を基準に反転する
  const toggle = useCallback(() => setDark(!readThemeFromDom()), [setDark]);

  return { isDark, areaKey, switchable, toggle, setDark };
}

/**
 * store と <html> を同期する常駐フック。アプリで 1 箇所(SiteThemeSync)だけが呼ぶ。
 * - パス遷移のたびに設定・保存値・OS 設定からテーマを解決し直す
 *   (管理画面でダークを選んでからユーザー側へ遷移しても、ユーザー側のロックが効く)
 * - DOM への反映は「唯一の書き手」としてここだけが行う。依存配列を持たせず毎描画で適用するのは、
 *   root layout が RSC 再描画(router.refresh 等)されると React が <html className> を
 *   SSR 近似値に patch するため、同じ commit 内で store の値に戻す必要があるから。
 *   useLayoutEffect なので paint 前に揃い、エリア遷移直後に 1 フレームだけ旧テーマが出ることもない。
 * - 初回同期前(synced=false)は書かない。bootstrap script が確定させた値を初期値 false で壊さないため
 * - OS 設定の変化に追従する(system モードのエリアで、保存値が無いときだけ効く)
 */
export function useSiteThemeSync() {
  const pathname = usePathname();
  const isDark = internalStore((s) => s.isDark);
  const areaKey = internalStore((s) => s.areaKey);
  const synced = internalStore((s) => s.synced);
  const setResolved = internalStore((s) => s.setResolved);

  const sync = useCallback(() => {
    const { area, isDark: resolvedDark } = resolveCurrentSiteTheme(pathname ?? undefined);
    setResolved({ isDark: resolvedDark, areaKey: area.key });
  }, [pathname, setResolved]);

  useEffect(() => {
    sync();
    return subscribeSystemPrefersDark(sync);
  }, [sync]);

  useLayoutEffect(() => {
    if (!synced) return;
    applyThemeToDom(isDark, areaKey ?? undefined);
  });
}
