// src/lib/gradient/config.ts
//
// グラデーションの設定(既定 + 上書き)。上書きは src/config/lib/gradient.config.ts(@lib-config/gradient)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// fork 固有のトークンは上書きの customGradients に足し、`pnpm generate styles` で src/styles/gradient.css を書き直してコミットする

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/gradient";
import type { GradientTokenInput } from "./types";

export type GradientConfig = {
  /** プロジェクト固有のグラデーション(既定: 空)。同じ key を書けば上流の既定を上書きする */
  customGradients: GradientTokenInput[];
};

const defaults: GradientConfig = {
  customGradients: [],
};

export const gradientConfigDef = defineConfig(defaults, { label: "gradient" });

/** 上書きのファイルの型(`export default { ... } satisfies GradientOverride`) */
export type GradientOverride<E extends object = Record<never, never>> = OverrideOf<typeof gradientConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const gradientConfig: GradientConfig = gradientConfigDef.compose(override);
