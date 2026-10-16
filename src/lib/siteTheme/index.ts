// src/lib/siteTheme/index.ts
//
// サイトテーマ(ライト / ダーク)の設定モデルと判定ロジック。
// - 設定の正: src/config/ui/site-theme.config.ts(下流所有、defineSiteThemeConfig の差分のみ)
// - SSR 判定: src/app/layout.tsx(x-pathname → <html class / data-area>)
// - クライアント同期: src/components/Fanctional/SiteThemeSync.tsx
// - DOM / 保存の実装: src/utils/siteTheme.ts
// 詳細: src/styles/README.md

export { SITE_THEME_DEFAULTS, SITE_THEME_STORAGE_KEY } from "./defaults";
export { defineSiteThemeConfig, normalizeAreaPrefix } from "./defineConfig";
export {
  getSiteThemeAreaByKey,
  matchesAreaPrefix,
  normalizeStoredPreference,
  resolveIsDark,
  resolveSiteTheme,
  resolveSiteThemeArea,
} from "./resolve";
export { buildSiteThemeBootstrapScript, SITE_THEME_AREA_ATTRIBUTE } from "./bootstrapScript";
export type {
  ResolvedSiteTheme,
  ResolvedSiteThemeArea,
  SiteThemeArea,
  SiteThemeConfig,
  SiteThemeConfigInput,
  SiteThemeFallback,
  SiteThemeMode,
  SiteThemeResolveInput,
  StoredThemePreference,
} from "./types";
