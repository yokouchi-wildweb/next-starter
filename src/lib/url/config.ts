// src/lib/url/config.ts
//
// アプリのベース URL の設定(既定 + 上書き)。上書きは src/config/lib/url.config.ts(@lib-config/url)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// 上流の上書きは事業の素性の URL(@/business の url)を写す。lib は @/business を直に読まない(閉じた lib の決まり)

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/url";

export type UrlConfig = {
  /**
   * 本番のベース URL(getAppBaseUrl のフォールバック)。公式の事業 URL。
   * 既定はプレースホルダー(このままなら getAppBaseUrl が throw する)。上流の上書きは business.url を写す
   */
  baseUrl: string;
};

const defaults: UrlConfig = {
  baseUrl: "https://example.com",
};

export const urlConfigDef = defineConfig(defaults, { label: "url" });

/** 上書きのファイルの型(`export default { ... } satisfies UrlOverride`) */
export type UrlOverride<E extends object = Record<never, never>> = OverrideOf<typeof urlConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const urlConfig: UrlConfig = urlConfigDef.compose(override);
