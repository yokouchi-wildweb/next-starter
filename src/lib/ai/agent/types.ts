// src/lib/ai/agent/types.ts
//
// AIエージェント基盤の「型契約」。
//
// このファイルは downstream の UI (チャット画面・ブロックレンダラー・ツール
// タイムライン) が直接バインドする安定契約なので、後方互換を壊す変更をしないこと。
// 変更が必要な場合は:
//  - フィールド追加 (optional) → 同一バージョンのまま可
//  - 既存フィールドの意味変更・削除 → AGENT_PROTOCOL_VERSION を上げ、旧型を残す
//
// サーバー専用コードを import しない (クライアントからも import される)。

/**
 * イベント/ブロック契約のプロトコルバージョン。
 * 全 AgentEvent に `v` として付与される。UI は未知のバージョン・未知の type を
 * 無視できるように実装すること (前方互換)。
 */
export const AGENT_PROTOCOL_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// 回答ブロック (最終回答の構造化表現)
// ---------------------------------------------------------------------------

/** チャートの1系列 */
export type AgentChartSeries = {
  name: string;
  data: number[];
};

/**
 * エージェントの最終回答を構成する型付きブロック。
 * レンダリングは downstream の責務 (upstream は型契約のみ提供)。
 */
export type AgentBlock =
  /** 本文 (Markdown)。見出し・箇条書き等を含む説明文 */
  | { type: "text"; markdown: string }
  /** 単一の数値・指標のハイライト表示 */
  | { type: "stat"; label: string; value: string | number; unit?: string }
  /** 表。rows は columns と同順の値配列。totalRows は切り捨て前の総行数 (判明時のみ) */
  | {
      type: "table";
      columns: string[];
      rows: (string | number | boolean | null)[][];
      totalRows?: number;
    }
  /** 簡易チャート。xLabels は series[].data と同順のX軸ラベル */
  | {
      type: "chart";
      kind: "bar" | "line";
      series: AgentChartSeries[];
      xLabels?: string[];
    }
  /** アプリ内エンティティへのリンク (例: 管理画面のユーザー詳細へ誘導) */
  | { type: "entity_link"; domain: string; id: string; label: string }
  /** 実行した SQL の提示 (透明性のため) */
  | { type: "sql"; query: string };

// ---------------------------------------------------------------------------
// ストリーミングイベント (SSE で配信される)
// ---------------------------------------------------------------------------

/** トークン使用量 (1ターン累計) */
export type AgentUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  /** このターンで消費した API 往復回数 */
  iterations: number;
};

/**
 * エージェント実行中にストリーム配信されるイベント。
 * UI は type で分岐し、未知の type は無視すること。
 */
export type AgentEvent =
  /** 本文テキストの逐次差分 */
  | { v: 1; type: "agent.text_delta"; delta: string }
  /** ツール実行の開始。label は UI 表示用の日本語ラベル */
  | {
      v: 1;
      type: "agent.tool_call_started";
      tool: string;
      label: string;
      /** 入力の人間可読な要約 (SQL全文など、UIのタイムライン表示用) */
      inputSummary: string;
    }
  /** ツール実行の完了 */
  | {
      v: 1;
      type: "agent.tool_result";
      tool: string;
      ok: boolean;
      /** 結果の人間可読な要約 (例: "42行取得") */
      summary: string;
      durationMs: number;
      /** ツール固有の付加情報 (例: { rowCount: 42 })。UI は存在チェックの上で利用 */
      meta?: Record<string, unknown>;
    }
  /** 構造化された最終回答ブロック */
  | { v: 1; type: "agent.blocks"; blocks: AgentBlock[] }
  /** ターン正常終了 (usage 確定) */
  | { v: 1; type: "agent.done"; usage: AgentUsage }
  /** エラー終了。message はユーザー提示可能な文言 */
  | { v: 1; type: "agent.error"; message: string };

// ---------------------------------------------------------------------------
// 会話履歴 (クライアント → サーバー)
// ---------------------------------------------------------------------------

/**
 * チャット履歴の1メッセージ。
 * サーバーはステートレスで、クライアントが履歴を保持して毎回全量送る。
 * assistant 側はテキスト表現のみ保持すればよい (ツール実行の中間履歴は
 * ターンをまたいで保持しない設計)。
 */
export type AgentChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// ---------------------------------------------------------------------------
// ツール定義契約 (エージェント実装・レジストリ登録用)
// ---------------------------------------------------------------------------

/** ツール実行時にランタイムから渡されるコンテキスト */
export type AgentToolContext = {
  /** クライアント切断等による中断シグナル */
  signal?: AbortSignal;
};

/** ツール実行結果 */
export type AgentToolRunResult = {
  /** モデルに返す内容 (テキスト。JSON文字列可) */
  content: string;
  /** エラー扱いにするか (モデルは自律的にリカバリを試みる) */
  isError?: boolean;
  /** agent.tool_result イベント用の要約 (省略時は content 先頭を切り詰め) */
  summary?: string;
  /** agent.tool_result イベント用の付加情報 (例: { rowCount: 42 }) */
  meta?: Record<string, unknown>;
};

/**
 * エージェントに渡すツールの定義。
 * 組み込みツールも downstream レジストリ登録ツールも同一契約。
 *
 * 安全上の注意: run に渡る input はモデル出力 (= 信頼できない入力) なので、
 * 各ツールは必ず自前で zod 等によりバリデーションすること。
 */
export type AgentToolDefinition = {
  /** ツール名 (モデルに公開される。snake_case) */
  name: string;
  /** UI 表示用の日本語ラベル (agent.tool_call_started.label に使用) */
  label: string;
  /** モデル向けの説明。いつ使うべきかを具体的に書く */
  description: string;
  /** 入力の JSON Schema (type: "object" であること) */
  inputSchema: Record<string, unknown>;
  /** agent.tool_call_started.inputSummary の生成 (省略時は input の JSON を切り詰め) */
  summarizeInput?: (input: unknown) => string;
  /** ツール本体。モデル出力の input を検証してから実行すること */
  run: (input: unknown, ctx: AgentToolContext) => Promise<AgentToolRunResult>;
};

// ---------------------------------------------------------------------------
// ランタイム入力
// ---------------------------------------------------------------------------

/** runAgent への入力 */
export type RunAgentOptions = {
  /**
   * システムプロンプト。安定部分 (キャッシュ対象) を先頭に、可変部分を
   * 末尾に置くこと (プロンプトキャッシュはプレフィックス一致のため)。
   */
  system: string;
  /** 会話履歴 (最後は user メッセージであること) */
  messages: AgentChatMessage[];
  /** 使用可能なツール群 */
  tools: AgentToolDefinition[];
  /** モデルID (省略時 AI_AGENT_CONFIG.model) */
  model?: string;
  /** 最大往復回数 (省略時 AI_AGENT_CONFIG.maxIterations) */
  maxIterations?: number;
  /** 1往復あたりの最大出力トークン (省略時 AI_AGENT_CONFIG.maxTokensPerStep) */
  maxTokensPerStep?: number;
  /** 中断シグナル (SSE クライアント切断時に abort される) */
  signal?: AbortSignal;
};
