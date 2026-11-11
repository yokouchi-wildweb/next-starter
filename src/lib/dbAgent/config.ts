// src/lib/dbAgent/config.ts
//
// DB 調査エージェントの設定(既定 + 上書き)。上書きは src/config/lib/dbAgent.config.ts(@lib-config/dbAgent)。
// 置き方: src/lib/README.md「設定の届け方」。合成: @/lib/defineConfig
// モデル・往復回数など AI ランタイムの設定は @/lib/ai の設定(src/config/lib/ai.config.ts)。

import { defineConfig, type OverrideOf } from "@/lib/defineConfig";
import override from "@lib-config/dbAgent";

export type DbAgentConfig = {
  /** run_query の 1 回あたり最大取得行数(超過分は切り捨てて truncated 報告) */
  maxRows: number;
  /** SQL statement timeout(ミリ秒)。読取専用接続の接続パラメータとして適用 */
  statementTimeoutMs: number;
  /** モデルに返すクエリ結果の最大文字数(コンテキスト圧迫防止) */
  maxResultChars: number;
  /** run_query に渡せる SQL の最大文字数 */
  maxQueryChars: number;
  /** 実行時システムプロンプトサフィックス(運営追加指示)の最大文字数(超過分は切り詰め) */
  maxSystemSuffixChars: number;
};

const defaults: DbAgentConfig = {
  maxRows: 200,
  statementTimeoutMs: 10_000,
  maxResultChars: 30_000,
  maxQueryChars: 10_000,
  maxSystemSuffixChars: 4_000,
};

export const dbAgentConfigDef = defineConfig(defaults, { label: "dbAgent" });

/** 上書きのファイルの型(`export default { ... } satisfies DbAgentOverride`) */
export type DbAgentOverride<E extends object = Record<never, never>> = OverrideOf<typeof dbAgentConfigDef, E>;

/** 合成済みの設定(読み込み時に 1 回作る) */
export const dbAgentConfig: DbAgentConfig = dbAgentConfigDef.compose(override);
