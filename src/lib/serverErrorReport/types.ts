// src/lib/serverErrorReport/types.ts
// サーバーの失敗の記録の型。項目(送り先)の形は Next の instrumentation と同じ引数を受ける
import type { Instrumentation } from "next";

/** Next が onRequestError に渡す第 2・第 3 引数 */
export type RequestErrorRequest = Parameters<Instrumentation.onRequestError>[1];
export type RequestErrorContext = Parameters<Instrumentation.onRequestError>[2];

/** 項目が動く runtime(既定 nodejs) */
export type ServerErrorRuntime = "nodejs" | "edge" | "both";

/**
 * 送り先の項目 1 つ(fork が自分の監視をつなぐ)。register と onRequestError はどちらも任意
 * - 項目のファイルの最上位では Node 専用の物を読まない(読むなら関数の中で import())
 */
export type ServerErrorReporter = {
  /** 記録の行で項目を名指す名前 */
  name: string;
  /** 動く runtime。既定 nodejs */
  runtime?: ServerErrorRuntime;
  /** サーバーの起動ごとに 1 回(Next の register と同じ時機) */
  register?: () => void | Promise<void>;
  /** 失敗 1 つごと。引数は Next の onRequestError と同じ */
  onRequestError?: Instrumentation.onRequestError;
};

/** 受け口が渡す項目の一覧(生成物の lazy な形) */
export type ServerErrorReporterLoader = { name: string; load: () => Promise<ServerErrorReporter> };

/** 記録の範囲: request = Next の onRequestError、api / cron / proxy = 入口が自分で受け止めた失敗 */
export type ServerErrorScope = "request" | "api" | "cron" | "proxy";

/** 入口が自分で受け止めた失敗を記録に渡すときの文脈 */
export type ServerErrorReportInput = {
  scope: ServerErrorScope;
  /** URL の道(クエリは記録の前に外す) */
  path: string;
  method: string;
  /** 項目へ渡すだけ(既定の行には書かない) */
  headers?: RequestErrorRequest["headers"];
  routePath?: string;
  routeType?: RequestErrorContext["routeType"];
  requestId?: string;
  /** cron のタスク名など、範囲ごとの名前 */
  name?: string;
};

export type ServerErrorReportOptions = {
  /** いまの runtime(呼び手が process.env.NEXT_RUNTIME から渡す。lib は env を読まない) */
  runtime: "nodejs" | "edge";
  /** 項目の onRequestError 1 回の待ち時間の上限(ms) */
  timeoutMs: number;
  /** 項目の register 1 回の待ち時間の上限(ms) */
  registerTimeoutMs: number;
  /** 1 行の書き手(既定 console.error。test が差し替える) */
  write?: (line: string) => void;
};
