// src/lib/metadata/config.ts
//
// ページのメタデータ(SEO・OGP)の既定の設定(既定 + 上書き)。上書きは src/config/lib/metadata.config.ts(@lib-config/metadata)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// 上流の上書きは事業の素性(@/business の serviceNameShort・url・seo)を写す。lib は @/business を直に読まない(閉じた lib の決まり、D88 K3)

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/metadata";

export type MetadataConfig = {
  /** OGP のサイト名 */
  siteName: string;
  /** サイトの URL(相対の OGP 画像を絶対にするときの起点) */
  siteUrl: string;
  /** OGP のロケール(例 "ja_JP") */
  locale: string;
  /** 既定の OGP 画像のパス(絶対か / 始まりの相対) */
  defaultOgImage: string;
  /** OGP 画像の大きさ */
  ogImageSize: { width: number; height: number };
  /** X(Twitter)のハンドル(@ なし。空なら creator を付けない) */
  twitterHandle: string;
};

const defaults: MetadataConfig = {
  siteName: "next-starter",
  siteUrl: "https://example.com",
  locale: "ja_JP",
  defaultOgImage: "/og-default.png",
  ogImageSize: { width: 1200, height: 630 },
  twitterHandle: "",
};

export const metadataConfigDef = defineConfig(defaults, { label: "metadata" });

/** 上書きのファイルの型(`export default { ... } satisfies MetadataOverride`) */
export type MetadataOverride<E extends object = Record<never, never>> = OverrideOf<typeof metadataConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const metadataConfig: MetadataConfig = metadataConfigDef.compose(override);
