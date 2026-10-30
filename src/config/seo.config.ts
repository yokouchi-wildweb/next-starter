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
  htmlLang: "en",

  /**
   * root の viewport。省略した項目は Next の既定。
   * env(safe-area-inset-*) を使うなら viewportFit: "cover" を足す（端に固定する要素と本文の左右は各自で余白を取る）
   */
  viewport: {
    width: "device-width",
    initialScale: 1,
  } satisfies Viewport as Viewport,

  /** Twitter/Xアカウント（@なし） */
  twitterHandle: "",

  /** デフォルトのdescription */
  defaultDescription: businessConfig.description,
} as const;

/** SEO設定の型 */
export type SeoConfig = typeof seoConfig;
