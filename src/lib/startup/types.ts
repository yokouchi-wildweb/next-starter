// src/lib/startup/types.ts
// 起動時の処理の型。項目(点 startupTasks の export const task)はサーバーの起動ごとに 1 回走る(Next の instrumentation の register と同じ時機)

/** 項目が動く runtime(既定 nodejs) */
export type StartupRuntime = "nodejs" | "edge" | "both";

/**
 * 起動時の処理 1 つ(例: 監視の SDK の初期化)。項目のファイルの最上位では Node 専用の物を読まない(読むなら run の中で import())
 */
export type StartupTask = {
  /** 記録の行で項目を名指す名前 */
  name: string;
  /** 動く runtime。既定 nodejs */
  runtime?: StartupRuntime;
  /** 起動ごとに 1 回。throw・上限越えは記録の 1 行にして、ほかの項目は止めない */
  run: () => void | Promise<void>;
};

/** 生成物が渡す項目の一覧(lazy な形) */
export type StartupTaskLoader = { name: string; load: () => Promise<StartupTask> };

export type StartupOptions = {
  /** いまの runtime(呼び手が渡す。lib は env を読まない) */
  runtime: "nodejs" | "edge";
  /** 項目 1 つの待ち時間の上限(ms) */
  timeoutMs: number;
  /** 1 行の書き手(既定 console.error。test が差し替える) */
  write?: (line: string) => void;
};
