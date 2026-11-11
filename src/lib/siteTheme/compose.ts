// src/lib/siteTheme/compose.ts
//
// 設定の合成。既定(./defaults.ts)に上書き(src/config/lib/siteTheme.config.ts = @lib-config/siteTheme)を
// 共通の合成器 @/lib/defineConfig で重ね、エリアの欠けた欄を埋めて検査する。
// 上書きのファイルは読まない(読むのは ./config.ts)。テストはここの composeSiteThemeConfig に上書きを渡す。

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

import { SITE_THEME_DEFAULTS } from "./defaults";
import type { SiteThemeArea, SiteThemeConfig, SiteThemeMode } from "./types";

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
 * 合成の規則: areas は key で合わせる(同じ key は部分更新で位置は既定のまま、知らない key は末尾に追加、
 * `{ key, $delete: true }` で消す)。fallback は部分更新。
 */
export const siteThemeConfigDef = defineConfig(SITE_THEME_DEFAULTS, {
  label: "siteTheme",
  arrays: { areas: { by: "key" } },
});

/** 上書きのファイルの型(`export default { ... } satisfies SiteThemeOverride`) */
export type SiteThemeOverride<E extends object = Record<never, never>> = OverrideOf<typeof siteThemeConfigDef, E>;

/**
 * 上書きを既定に重ねて、完全な設定を返す。
 * - 追加したエリアの書かなかった欄は match=[] / mode=light / switchable=false
 * - match の接頭辞を正規化し、mode を検査する(fallback も)
 */
export function composeSiteThemeConfig(override: SiteThemeOverride = {}): SiteThemeConfig {
  const composed = siteThemeConfigDef.compose(override);

  const areas: SiteThemeArea[] = composed.areas.map((a: Partial<SiteThemeArea> & { key: string }) => ({
    key: a.key,
    match: (a.match ?? []).map(normalizeAreaPrefix),
    mode: a.mode ?? "light",
    switchable: a.switchable ?? false,
  }));
  for (const area of areas) {
    assertMode(area.mode, `areas[${area.key}]`);
  }

  const fallback = { ...composed.fallback };
  assertMode(fallback.mode, "fallback");

  return { storageKey: composed.storageKey, areas, fallback };
}
