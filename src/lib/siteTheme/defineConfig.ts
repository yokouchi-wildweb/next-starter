// src/lib/siteTheme/defineConfig.ts
//
// 下流の差分を上流既定値にマージして完全な設定を返す。
// 設定ファイル(src/config/ui/site-theme.config.ts)はこの関数を 1 回呼ぶだけにし、
// ロジックを持たない(CLAUDE.md: config は値のみ)。

import { SITE_THEME_DEFAULTS } from "./defaults";
import type {
  SiteThemeArea,
  SiteThemeConfig,
  SiteThemeConfigInput,
  SiteThemeMode,
} from "./types";

const VALID_MODES: readonly SiteThemeMode[] = ["light", "dark", "system"];

/**
 * 接頭辞の正規化: 先頭 `/` を保証し、`/` 以外は末尾 `/` を落とす。
 * 空文字は throw する(`/` に正規化すると全パスを飲む catch-all になり、typo がフェイルオープンになるため)。
 * 全パスに一致させたい場合は明示的に `"/"` と書く。
 */
export function normalizeAreaPrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (trimmed === "") {
    throw new Error('[siteTheme] areas[].match に空文字は使えません。全パスに一致させるには "/" と書いてください');
  }
  const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeading === "/") return withLeading;
  return withLeading.replace(/\/+$/, "");
}

function assertMode(mode: SiteThemeMode, where: string): void {
  if (!VALID_MODES.includes(mode)) {
    throw new Error(
      `[siteTheme] ${where}.mode は light | dark | system のいずれかにしてください (received: ${String(mode)})`,
    );
  }
}

/**
 * 差分を既定値にマージする。
 * - areas: key が既定に存在すれば部分更新(位置は維持)、無ければ末尾に追加。
 *   追加する項目には match / mode / switchable が必須(未指定は mode=light, switchable=false, match=[])。
 * - fallback: 部分更新
 */
export function defineSiteThemeConfig(input: SiteThemeConfigInput = {}): SiteThemeConfig {
  const areas: SiteThemeArea[] = SITE_THEME_DEFAULTS.areas.map((a) => ({ ...a }));

  for (const patch of input.areas ?? []) {
    const index = areas.findIndex((a) => a.key === patch.key);
    if (index >= 0) {
      areas[index] = { ...areas[index], ...patch, key: areas[index].key };
    } else {
      areas.push({
        key: patch.key,
        match: patch.match ?? [],
        mode: patch.mode ?? "light",
        switchable: patch.switchable ?? false,
      });
    }
  }

  const normalized: SiteThemeArea[] = areas.map((a) => ({
    ...a,
    match: a.match.map(normalizeAreaPrefix),
  }));

  for (const area of normalized) {
    assertMode(area.mode, `areas[${area.key}]`);
  }

  const fallback = { ...SITE_THEME_DEFAULTS.fallback, ...input.fallback };
  assertMode(fallback.mode, "fallback");

  return {
    storageKey: input.storageKey ?? SITE_THEME_DEFAULTS.storageKey,
    areas: normalized,
    fallback,
  };
}
