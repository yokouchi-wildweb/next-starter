// src/config/app/ai-agent.config.ts

/**
 * AIエージェント基盤 (@/lib/ai) の実行設定
 *
 * ここはモデル・上限値などの「値」のみを置く。ロジックは @/lib/ai 側に置くこと。
 * downstream はこのファイルの値を書き換えることで挙動を調整できる。
 *
 * 注意:
 * - model は Claude の正確なモデルIDを指定する (エイリアス可)。
 *   Opus 4.7 以降は temperature / top_p / top_k が使えない (400) ため、
 *   ランタイム側でもサンプリングパラメータは一切送っていない。
 * - maxIterations は「1ターン内のAPI往復回数」の上限 (ツール実行ループの暴走防止)。
 * - maxTokensPerStep は「1往復あたり」の出力上限 (thinking + text + tool呼び出しを含む)。
 */
export const AI_AGENT_CONFIG = {
  /** 使用モデル (既定: Opus 4.8。コスト重視なら "claude-sonnet-5" 等に差し替え可) */
  model: "claude-opus-4-8",

  /** 1ターン内のツール実行ループの最大往復回数 */
  maxIterations: 12,

  /** 1往復あたりの最大出力トークン数 */
  maxTokensPerStep: 16000,
} as const;

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
} as const;
