// src/lib/ai/config.ts
//
// AI エージェント基盤の実行設定(既定 + 上書き)。上書きは src/config/lib/ai.config.ts(@lib-config/ai)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
//
// 注意:
// - model は Claude の正確なモデル ID を指定する(エイリアス可)。
//   Opus 4.7 以降は temperature / top_p / top_k が使えない(400)ため、ランタイム側でもサンプリングパラメータは一切送らない。
// - maxIterations は「1 ターン内の API 往復回数」の上限(ツール実行ループの暴走防止)。
// - maxTokensPerStep は「1 往復あたり」の出力上限(thinking + text + tool 呼び出しを含む)。
// - runAgent の options(model / maxIterations / maxTokensPerStep)は呼び出しごとにこの値より優先する。

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/ai";

export type AiConfig = {
  /** 使用モデル(既定: Opus 4.8。コスト重視なら "claude-sonnet-5" 等に差し替え可) */
  model: string;
  /** 1 ターン内のツール実行ループの最大往復回数 */
  maxIterations: number;
  /** 1 往復あたりの最大出力トークン数 */
  maxTokensPerStep: number;
};

const defaults: AiConfig = {
  model: "claude-opus-4-8",
  maxIterations: 12,
  maxTokensPerStep: 16000,
};

export const aiConfigDef = defineConfig(defaults, { label: "ai" });

/** 上書きのファイルの型(`export default { ... } satisfies AiOverride`) */
export type AiOverride<E extends object = Record<never, never>> = OverrideOf<typeof aiConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const aiConfig: AiConfig = aiConfigDef.compose(override);
