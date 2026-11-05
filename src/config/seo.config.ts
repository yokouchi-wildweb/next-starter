import type { Viewport } from "next";

import { businessConfig } from "./business.config";

/**
 * SEO・メタデータ共通設定
 * サイト全体のOGP、Twitter Card、構造化データなどの基本設定を管理
 */
export const seoConfig = {
  /** サイト名（OGPやtitle templateで使用） */
  siteName: businessConfig.serviceNameShort,

  /** サイトURL（canonical URL、OGPで使用） */
  siteUrl: businessConfig.url,

  /** デフォルトのOGP画像パス（絶対パスまたは相対パス） */
  defaultOgImage: "/og-default.png",

  /** OGP画像のサイズ */
  ogImageSize: {
    width: 1200,
    height: 630,
  },

  /** ロケール（OGP） */
  locale: "ja_JP",

  /** <html lang> */
  htmlLang: "ja",

  /**
   * root の viewport。省略した項目は Next の既定。
   * viewportFit "cover" = 画面の端(切り欠きの下)まで描く。枠の部品は --app-safe-area-*(src/styles/core/config.css)で端を避ける。
   * 枠の外で端に固定する要素も同じ変数で避ける(env() は直接書かない)
   */
  viewport: {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  } satisfies Viewport as Viewport,

  /** Twitter/Xアカウント（@なし） */
  twitterHandle: "",

  /** デフォルトのdescription */
  defaultDescription: businessConfig.description,
} as const;

/** SEO設定の型 */
export type SeoConfig = typeof seoConfig;
