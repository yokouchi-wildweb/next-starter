// src/lib/serverErrorReport/wire.ts
// 結び目の作り手(D31): 生成物 src/wiring/serverErrorReport.ts が、門番で絞った送り先の一覧を渡して 1 つの記録を作る(宣言 ./extensionPoints.ts の wire)。
// 待ち時間の上限はここに持ち、いまの runtime は Next の edge の目印(globalThis.EdgeRuntime)で見る(env は読まない)
import { createServerErrorReport, type ServerErrorReport } from "./createServerErrorReport";
import type { ServerErrorReporterLoader } from "./types";

/** 項目の onRequestError 1 回の待ち時間の上限。route handler の応答は Next がこれを待つので短く */
export const REPORTER_TIMEOUT_MS = 1500;

/** いまの runtime: Next は edge の束にだけ globalThis.EdgeRuntime(文字列)を置く。無ければ nodejs */
export const currentRuntime = (): "nodejs" | "edge" => (typeof (globalThis as { EdgeRuntime?: unknown }).EdgeRuntime === "string" ? "edge" : "nodejs");

/** 生成物が渡す一覧(点 serverErrorReporters、項目は lazy) */
export type ServerErrorReportLists = { serverErrorReporters: readonly ServerErrorReporterLoader[] };

export function wireServerErrorReport(lists: ServerErrorReportLists): ServerErrorReport {
  return createServerErrorReport(lists.serverErrorReporters, {
    runtime: currentRuntime(),
    timeoutMs: REPORTER_TIMEOUT_MS,
  });
}
