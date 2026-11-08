// src/config/business.config.ts — 古い置き場の殻(締め 2 で消す。新しい読み手を足さない)
// 事業の素性の正本は @/business(src/business/business.ts、決まり: src/lib/business/README.md)。この殻は @/business の値を写すだけ。
// 法務の文書が読む値(決済方法の表示・日付・許認可)は legal の上書き src/config/features/legal.config.ts へ移った(src/features/core/legal/README.md)。
// 読み手: lib/mail・lib/url・lib/metadata(lib は @/business を直に読まない。lib の設定の上書きが写す形は棚の lib を閉じるクエスト)
import { business } from "@/business";

/**
 * 事業者・サービスの基本設定(殻)。@/business の値 + lib/metadata が読む seo の名前
 */
export const businessConfig = {
  ...business,

  // === SEO(lib/metadata が読む。値は @/business の seo と serviceNameShort・url・description から) ===
  seo: {
    ...business.seo,
    siteName: business.serviceNameShort,
    siteUrl: business.url,
    defaultDescription: business.description,
  },
} as const;

/** 事業者設定の型 */
export type BusinessConfig = typeof businessConfig;
