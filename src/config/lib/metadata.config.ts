// src/config/lib/metadata.config.ts
// ページのメタデータ(SEO・OGP)の既定の上書き(@lib-config/metadata)。値はリテラルか @/business の値。キーと既定: src/lib/metadata/config.ts
// 上流は事業の素性を写す(サイト名・URL・OGP は src/business/business.ts で変える)
import { business } from "@/business";
import type { MetadataOverride } from "@/lib/metadata";

export default {
  siteName: business.serviceNameShort,
  siteUrl: business.url,
  locale: business.seo.locale,
  defaultOgImage: business.seo.defaultOgImage,
  ogImageSize: business.seo.ogImageSize,
  twitterHandle: business.seo.twitterHandle,
} satisfies MetadataOverride;
