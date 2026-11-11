// src/lib/siteTheme/index.ts
//
// サイトテーマ(ライト / ダーク)の入口。説明: README.md
// - 設定: siteThemeConfig(既定 ./defaults.ts + 上書き src/config/lib/siteTheme.config.ts、型 SiteThemeOverride)
// - SSR 判定: src/app/layout.tsx(x-pathname → <html class / data-area>)と <head> の bootstrap script
// - クライアント同期: SiteThemeSync(root layout に 1 つ。<html> を書くのはこれだけ)
// - 切替: useSiteThemeStore(DarkModeSwitch など)

export { SITE_THEME_DEFAULTS, SITE_THEME_STORAGE_KEY } from "./defaults";
export { normalizeAreaPrefix } from "./compose";
export type { SiteThemeOverride } from "./compose";
export { siteThemeConfig } from "./config";
export {
  getSiteThemeAreaByKey,
  matchesAreaPrefix,
  normalizeStoredPreference,
  resolveIsDark,
  resolveSiteTheme,
  resolveSiteThemeArea,
} from "./resolve";
export { buildSiteThemeBootstrapScript, SITE_THEME_AREA_ATTRIBUTE } from "./bootstrapScript";
export { SiteThemeSync } from "./SiteThemeSync";
export { useSiteThemeStore } from "./stores";
export type {
  ResolvedSiteTheme,
  ResolvedSiteThemeArea,
  SiteThemeArea,
  SiteThemeConfig,
  SiteThemeFallback,
  SiteThemeMode,
  SiteThemeResolveInput,
  StoredThemePreference,
} from "./types";
