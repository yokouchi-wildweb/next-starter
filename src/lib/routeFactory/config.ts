// src/lib/routeFactory/config.ts
//
// route factory の設定(既定 + 上書き)。上書きは src/config/lib/routeFactory.config.ts(@lib-config/routeFactory)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/routeFactory";

export type RouteFactoryConfig = {
  recaptcha: {
    /**
     * reCAPTCHA v3 のスコアの閾値(0.0〜1.0。route の `recaptcha.threshold` を省いた時の既定)
     * - スコア >= threshold → 通す
     * - v2Threshold <= スコア < threshold → v2 のチャレンジ
     * - スコア < v2Threshold → 止める
     */
    threshold: number;
    /** reCAPTCHA v2 のチャレンジの閾値(これ未満は止める。route の `recaptcha.v2Threshold` を省いた時の既定) */
    v2Threshold: number;
  };
};

const defaults: RouteFactoryConfig = {
  recaptcha: { threshold: 0.7, v2Threshold: 0.3 },
};

export const routeFactoryConfigDef = defineConfig(defaults, { label: "routeFactory" });

/** 上書きのファイルの型(`export default { ... } satisfies RouteFactoryOverride`) */
export type RouteFactoryOverride<E extends object = Record<never, never>> = OverrideOf<typeof routeFactoryConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const routeFactoryConfig: RouteFactoryConfig = routeFactoryConfigDef.compose(override);
