// src/lib/siteTheme/defaults.ts
//
// サイトテーマ設定の上流既定値。下流はこのファイルを編集せず、
// src/config/ui/site-theme.config.ts に差分だけを書く。
//
// 既定値は従来挙動の再現: 全エリアがライト既定、管理画面(/admin, /debug)のみ切替可、
// ユーザー側は切替不可(= 管理画面でダークを選んでもユーザー側に漏れない)。

import type { SiteThemeConfig } from "./types";

/** 従来からの localStorage キー。既存利用者の保存値と互換 */
export const SITE_THEME_STORAGE_KEY = "theme";

export const SITE_THEME_DEFAULTS: SiteThemeConfig = {
  storageKey: SITE_THEME_STORAGE_KEY,
  areas: [
    {
      key: "admin",
      match: ["/admin", "/debug"],
      mode: "light",
      switchable: true,
    },
  ],
  fallback: {
    key: "user",
    mode: "light",
    switchable: false,
  },
};
