// src/lib/siteTheme/config.ts
//
// サイトテーマの設定(既定 + 上書き)。上書きは src/config/lib/siteTheme.config.ts(@lib-config/siteTheme)。
// 置き方: src/lib/README.md「設定の届け方」。合成と検査: ./compose.ts

import override from "@lib-config/siteTheme";

import { composeSiteThemeConfig } from "./compose";
import type { SiteThemeConfig } from "./types";

/** 合成済みの設定(読み込み時に 1 回作る)。root layout・SiteThemeSync・DarkModeSwitch が読む */
export const siteThemeConfig: SiteThemeConfig = composeSiteThemeConfig(override);
