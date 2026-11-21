// src/lib/serverErrorReport/index.ts
// サーバーの失敗の記録の入口(閉じた lib)。結ぶのは src/wiring/serverErrors
export { createServerErrorReport, type ServerErrorReport } from "./createServerErrorReport";
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
