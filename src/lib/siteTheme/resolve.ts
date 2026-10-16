// src/lib/siteTheme/resolve.ts
//
// パス・保存値・OS 設定からテーマを決める純関数。
// SSR(root layout)、クライアント(SiteThemeSync / store)、bootstrap script の
// 3 箇所が同じ判定をする必要があるため、ロジックはここに一本化する。
// bootstrap script は JS 文字列なので同じロジックを手書きしており、
// 一致は siteTheme.test.mjs で同一ケース集を両方に流して保証する。

import type {
  ResolvedSiteTheme,
  ResolvedSiteThemeArea,
  SiteThemeConfig,
  SiteThemeResolveInput,
  StoredThemePreference,
} from "./types";

/** セグメント境界でのパス接頭辞一致。`/` は全パスに一致 */
export function matchesAreaPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return true;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** パスが属するエリアを返す(先頭一致順、無ければ fallback) */
export function resolveSiteThemeArea(
  config: SiteThemeConfig,
  pathname: string,
): ResolvedSiteThemeArea {
  for (const area of config.areas) {
    if (area.match.some((prefix) => matchesAreaPrefix(pathname, prefix))) {
      return { key: area.key, mode: area.mode, switchable: area.switchable };
    }
  }
  return {
    key: config.fallback.key,
    mode: config.fallback.mode,
    switchable: config.fallback.switchable,
  };
}

/**
 * エリアと保存値・OS 設定からダークかどうかを決める。
 * - switchable なエリアで保存値があればそれを優先(利用者の選択)
 * - それ以外は mode に従う。system は OS 設定
 * switchable=false のエリアでは保存値を見ない = 他エリアで選んだ値が漏れない。
 */
export function resolveIsDark(
  area: ResolvedSiteThemeArea,
  stored: StoredThemePreference,
  systemPrefersDark: boolean,
): boolean {
  if (area.switchable && (stored === "dark" || stored === "light")) {
    return stored === "dark";
  }
  if (area.mode === "system") return systemPrefersDark;
  return area.mode === "dark";
}

export function resolveSiteTheme(
  config: SiteThemeConfig,
  input: SiteThemeResolveInput,
): ResolvedSiteTheme {
  const area = resolveSiteThemeArea(config, input.pathname);
  return { area, isDark: resolveIsDark(area, input.stored, input.systemPrefersDark) };
}

/** エリア key から設定を引く(store が保持する areaKey → switchable 判定用)。無ければ fallback */
export function getSiteThemeAreaByKey(
  config: SiteThemeConfig,
  key: string | null | undefined,
): ResolvedSiteThemeArea {
  const area = key ? config.areas.find((a) => a.key === key) : undefined;
  if (area) return { key: area.key, mode: area.mode, switchable: area.switchable };
  return {
    key: config.fallback.key,
    mode: config.fallback.mode,
    switchable: config.fallback.switchable,
  };
}

/** localStorage の生の値を StoredThemePreference に正規化する */
export function normalizeStoredPreference(raw: string | null | undefined): StoredThemePreference {
  return raw === "dark" || raw === "light" ? raw : null;
}
