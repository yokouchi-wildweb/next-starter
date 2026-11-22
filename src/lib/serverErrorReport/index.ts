// src/lib/serverErrorReport/index.ts
// サーバーの失敗の記録の入口(閉じた lib)。結び目は生成物 src/wiring/serverErrorReport.ts(宣言 ./extensionPoints.ts の wire)。約束の型もこの入口から(型だけの入口は段 3 の lint の札で決める)
export { createServerErrorReport, type ServerErrorReport } from "./createServerErrorReport";
export { wireServerErrorReport, currentRuntime, type ServerErrorReportLists } from "./wire";
export { stripQuery, type ServerErrorLine } from "./format";
export type {
  RequestErrorContext,
  RequestErrorRequest,
  ServerErrorReportInput,
  ServerErrorReportOptions,
  ServerErrorReporter,
  ServerErrorReporterLoader,
  ServerErrorRuntime,
  ServerErrorScope,
} from "./types";
