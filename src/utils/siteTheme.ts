// src/utils/siteTheme.ts
//
// サイトテーマのブラウザ側実装(DOM への適用・保存値の読み書き)。
// 判定ロジックは @/lib/siteTheme の純関数に委ね、ここは副作用だけを持つ。
//
// 「表示(DOM)」と「保存(localStorage)」は分離している:
// - applyThemeToDom: <html> のクラスと data-area を更新するだけ。保存しない
// - persistThemePreference: 利用者が切替操作をしたときだけ呼ぶ
// 固定エリアの適用や OS 設定への追従で保存値を汚さないため。

import { SITE_THEME_CONFIG } from "@/config/ui/site-theme.config";
import {
  normalizeStoredPreference,
  resolveSiteTheme,
  SITE_THEME_AREA_ATTRIBUTE,
  type ResolvedSiteTheme,
  type StoredThemePreference,
} from "@/lib/siteTheme";

const DARK_CLASS = "dark";
const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

/** 保存された利用者の選択を読む(SSR / アクセス不可時は null) */
export const readStoredThemePreference = (): StoredThemePreference => {
  if (!isBrowser()) return null;
  try {
    return normalizeStoredPreference(window.localStorage.getItem(SITE_THEME_CONFIG.storageKey));
  } catch {
    return null;
  }
};

/** OS がダーク配色か(SSR / 非対応時は false) */
export const readSystemPrefersDark = (): boolean => {
  if (!isBrowser() || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
};

/** system モードの追従用。OS 設定の変化を購読し、解除関数を返す */
export const subscribeSystemPrefersDark = (listener: (prefersDark: boolean) => void): (() => void) => {
  if (!isBrowser() || typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(SYSTEM_DARK_QUERY);
  const handler = (event: MediaQueryListEvent) => listener(event.matches);
  query.addEventListener("change", handler);
  return () => query.removeEventListener("change", handler);
};

/**
 * 現在のパス・保存値・OS 設定からテーマを解決する。
 * SSR では window が無いので fallback エリアの mode による既定値(system は light)を返す。
 */
export const resolveCurrentSiteTheme = (pathname?: string): ResolvedSiteTheme => {
  const path = pathname ?? (isBrowser() ? window.location.pathname : "/");
  return resolveSiteTheme(SITE_THEME_CONFIG, {
    pathname: path,
    stored: readStoredThemePreference(),
    systemPrefersDark: readSystemPrefersDark(),
  });
};

/** <html> に dark クラスと data-area を反映する。保存はしない */
export const applyThemeToDom = (isDark: boolean, areaKey?: string): void => {
  if (!isBrowser()) return;
  const root = document.documentElement;
  root.classList.toggle(DARK_CLASS, isDark);
  if (areaKey) root.setAttribute(SITE_THEME_AREA_ATTRIBUTE, areaKey);
};

/** DOM 上の現在値(bootstrap script / SSR が確定させた状態)を読む */
export const readThemeFromDom = (): boolean => {
  if (!isBrowser()) return false;
  return document.documentElement.classList.contains(DARK_CLASS);
};

/** 利用者の選択を保存する。切替操作時のみ呼ぶこと */
export const persistThemePreference = (isDark: boolean): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(SITE_THEME_CONFIG.storageKey, isDark ? "dark" : "light");
  } catch {
    // プライベートモード等で保存できなくても表示は維持する
  }
};
