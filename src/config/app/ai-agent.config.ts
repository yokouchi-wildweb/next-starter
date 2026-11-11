// src/config/app/ai-agent.config.ts

// AI エージェント基盤 (@/lib/ai) の model / maxIterations / maxTokensPerStep は lib の設定へ移った:
// 既定 src/lib/ai/config.ts、上書き src/config/lib/ai.config.ts(@lib-config/ai)

/**
 * DB調査エージェント (@/lib/dbAgent) 固有の設定
 */
export const DB_AGENT_CONFIG = {
  /** run_query の1回あたり最大取得行数 (超過分は切り捨てて truncated 報告) */
  maxRows: 200,

  /** SQL statement timeout (ミリ秒)。読取専用接続の接続パラメータとして適用 */
  statementTimeoutMs: 10_000,

  /** モデルに返すクエリ結果の最大文字数 (コンテキスト圧迫防止) */
  maxResultChars: 30_000,

  /** run_query に渡せる SQL の最大文字数 */
  maxQueryChars: 10_000,

  /** 実行時システムプロンプトサフィックス (運営追加指示) の最大文字数 (超過分は切り詰め) */
  maxSystemSuffixChars: 4_000,
} as const;
