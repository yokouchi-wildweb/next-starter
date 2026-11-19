// src/lib/variantOverrides/config.ts
//
// 部品の variant の上書き(既定 + 上書き)。上書きは src/config/lib/variantOverrides.config.ts(@lib-config/variantOverrides)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// 何も書かなければ上流の見た目のまま。書いたクラスが cva の出力の後ろに結合され、同じプロパティは後勝ち(tailwind-merge)。
// 使えるキー(上流が保つ契約。variant / size 名は各部品の定義と同じ)は ./types.ts の VariantOverridesInput。
// 部品は variantOverrides を読む(未指定のキーは defineVariantOverrides が空で埋める)

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/variantOverrides";
import { defineVariantOverrides } from "./defineConfig";
import type { VariantOverrides, VariantOverridesInput } from "./types";

const defaults: VariantOverridesInput = {};

export const variantOverridesConfigDef = defineConfig(defaults, { label: "variantOverrides" });

/** 上書きのファイルの型(`export default { button: { base: "rounded-full" } } satisfies VariantOverridesOverride`) */
export type VariantOverridesOverride<E extends object = Record<never, never>> = OverrideOf<typeof variantOverridesConfigDef, E>;

/** 合成済みの上書き(読み込み時に 1 回作る、未指定のキーは空) */
export const variantOverrides: VariantOverrides = defineVariantOverrides(variantOverridesConfigDef.compose(override) as VariantOverridesInput);
