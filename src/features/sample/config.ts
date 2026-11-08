// src/features/sample/config.ts
// サンプルのドメイン(sample・sampleCategory・sampleTag・sampleImage)の設定(既定 + 上書き)。形は pnpm generate domain の閉じられる形の雛形と同じ。
// 上書きは src/config/features/sample.config.ts(このファイルだけが読む)。置き方: src/config/README.md。合成: @/lib/defineConfig
// enabled: false にすると門番の規則 src/featureGate/rules/sampleDomain.ts がサンプル 4 ドメインの管理画面・API・サンプルを読むデモ画面を閉じ、
// db:push は 5 表を作らない(既存の表は消さない)。既定 true は上流のデモ用(権限は厳しくしていない)。実際の利用者がいる fork は上書きで false

import override from "@/config/features/sample.config";
import { defineConfig, type OverrideOf } from "@/lib/defineConfig";

export type SampleConfig = {
  /** サンプルのドメインを使うか(閉じる値) */
  enabled: boolean;
};

const defaults: SampleConfig = {
  enabled: true,
};

export const sampleConfigDef = defineConfig(defaults, { label: "sample" });

/** 上書きのファイルの型(`export default { ... } satisfies SampleOverride`) */
export type SampleOverride<E extends object = Record<never, never>> = OverrideOf<typeof sampleConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const SAMPLE_CONFIG: SampleConfig = sampleConfigDef.compose(override);
